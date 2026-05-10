# Load Dresses From Make.com Webhook — Design

## Context

Today the dress catalog is hard-coded in `src/services/mockData.ts` (`MOCK_DRESSES`) and exposed by `MockDressesService`. There is no database in this project — the production design is "everything goes through Make.com": the existing submit webhook (`VITE_MAKE_WEBHOOK_URL`) creates rental rows in EasyFlow, and a new dresses webhook should return the live dress catalog from EasyFlow on page load.

The new webhook is already deployed by the user at:

```
https://hook.eu1.make.com/ckfk7tujrdsu1c753mqe3cdlfb8xb1br
```

Its scenario: receive `{ record_id }` → fetch the lead from EasyFlow → search active dresses in EasyFlow → array-aggregate the dresses → respond with `{ user, items }`.

**Goal:** replace the mock dress source with a live fetch from this webhook, keyed by the `record_id` passed in the URL. Continue to send rental requests through the existing submit webhook untouched.

## Approved decisions (from brainstorming)

1. **Architecture:** one new service, `leadContextService`, with a single method `fetchLeadContext(recordId)` returning `{ user, dresses }`. Mirrors the webhook's natural boundary 1:1.
2. **No database, ever.** Reads come from this new webhook; writes go through the existing submit webhook. No persistence client-side beyond React state.
3. **Active-status filtering happens in Make.com**, not in the frontend. The site shows whatever `items` the webhook returns.
4. **Reservations stay mocked** for now (`MOCK_ORDER_LINES` in `mockData.ts`). The dresses webhook does not return reservations, and re-wiring availability is out of scope for this change.
5. **Unknown `record_id`** is detected by the webhook returning `user: null`. The site shows a dedicated full-screen Hebrew message "ליד לא נמצא" (mirroring the look of `MissingRecordIdScreen` / `MissingWebhookScreen`) and does not render the form.
6. The combobox is refactored to be a pure controlled component fed by a `dresses` prop — it no longer self-fetches.
7. The `user` object returned by the webhook is stored in `RequestPage` state but unused for now. The user has flagged that future work will display user info on the page.

## Webhook contract

### Request (frontend → Make.com)

`POST <VITE_MAKE_DRESSES_WEBHOOK_URL>`
Headers: `Content-Type: application/json`
Body:

```json
{ "record_id": "7bfde42c-5d00-49bd-9de3-9094e5d0f0ea" }
```

### Response (Make.com → frontend, `200 OK`)

```json
{
  "user": {
    "id": "<lead uuid>",
    "entity_id": "...",
    "tenant_id": "...",
    "data": { "phone": "...", "full_name": "...", /* …other lead fields… */ },
    "computed": {},
    "display_name": "...",
    "created_at": "...",
    "updated_at": "...",
    "created_by": null,
    "updated_by": null
  },
  "items": [
    {
      "id": "<dress uuid>",
      "data": {
        "name": "שמלה כתומה",
        "status": "0",
        "dress_type": "0",
        "daily_price": { "amount": 100, "currency_code": "ILS" },
        "picture": null,
        "dress_type_label": "שמלת ערב",
        "status_label": "פעיל"
      },
      "name": null,
      "email": null,
      "computed": {},
      "created_at": "...",
      "updated_at": "...",
      "__IMTINDEX__": 1,
      "__IMTLENGTH__": 3
    }
  ]
}
```

The `__IMTINDEX__` / `__IMTLENGTH__` / top-level `name` and `email` fields on each item are leftover Make.com bundle metadata and are ignored.

## Architecture

### New: `src/services/leadContextService.ts`

```ts
export interface LeadContextService {
  fetchLeadContext(recordId: string): Promise<LeadContext>;
}
```

Default export is a Make.com-backed implementation that reads `VITE_MAKE_DRESSES_WEBHOOK_URL` at construction time and POSTs to it. The mock implementation used by tests injects a fake `fetch` (or is just a hand-rolled object satisfying the interface).

### New types in `src/types/domain.ts`

```ts
export interface LeadUser {
  id: string;
  entity_id: string;
  tenant_id: string;
  display_name: string | null;
  data: Record<string, unknown>;     // loose — fields used later
  computed: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadContext {
  user: LeadUser | null;
  dresses: Dress[];
}
```

`LeadUser` is intentionally loose — only the structurally stable fields are typed; the variable-shape `data` / `computed` blobs stay as `Record<string, unknown>` until concrete user-info features arrive. `user` is nullable because the webhook may legitimately return `null` (e.g., unknown `record_id`); see decision #5. The `LeadUser` shape acts as a structural hint, not a runtime contract — no runtime validation of inner fields (see "Validation" below).

### New: `src/components/LoadFailedScreen.tsx`

Hebrew error screen with a "נסו שוב" button. Receives an `onRetry: () => void` prop. Shown whenever `leadContextService.fetchLeadContext` rejects.

### New: `src/components/LeadNotFoundScreen.tsx`

Static Hebrew error screen rendered when the webhook returns `user: null`. Same visual layout as `MissingRecordIdScreen`. Headline: "ליד לא נמצא". Body: "לא נמצאה רשומת לקוח עם המזהה שסופק. אנא צרו קשר עם התמיכה." No retry button — refetching won't conjure the missing record.

### Modified: `src/components/DressCombobox.tsx`

- Add prop: `dresses: Dress[]`.
- Remove imports of and calls to `dressesService`.
- Remove `useDebouncedValue`, `loading` state, in-flight `requestId` tracking — no async work left.
- Filter client-side: `dresses.filter(d => d.name.toLowerCase().includes(query.toLowerCase().trim()))`. Empty query → return all.

### Modified: `src/components/DressRow.tsx`

Forward the existing `dresses: Dress[]` prop down to `DressCombobox`. (`DressRow` already receives `dresses`, so the only change is one extra line wiring it through.)

### Modified: `src/pages/RequestPage.tsx`

- Add env read: `const dressesWebhookUrl = import.meta.env.VITE_MAKE_DRESSES_WEBHOOK_URL`.
- If either webhook env var is missing → render `MissingWebhookScreen` (existing component, unchanged).
- Replace the current `Promise.all([dressesService.listDresses(), orderLinesService.listAllOrderLines()])` with `Promise.all([leadContextService.fetchLeadContext(recordId), orderLinesService.listAllOrderLines()])`.
- Add a `loadError: boolean` state. On rejection, set `loadError = true` and render `LoadFailedScreen` with an `onRetry` that resets the state and re-runs the load effect (e.g., a `loadKey` counter in the dependency array).
- Add a `user: LeadUser | null` state. Set on success.
  - If the resolved `user === null` → render `LeadNotFoundScreen` instead of the form.
  - Otherwise the value sits in state unused in the JSX for now (placeholder for the upcoming user-info display work).
- Pass the loaded `dresses` down through `DressRow` → `DressCombobox`.

### Deleted

- `src/services/dressesService.ts` — no longer used.
- `MOCK_DRESSES` export from `src/services/mockData.ts`. Keep `MOCK_ORDER_LINES`.

### Env

- Add `VITE_MAKE_DRESSES_WEBHOOK_URL` alongside the existing `VITE_MAKE_WEBHOOK_URL`. Documented in `README.md`. (No `.env.example` is committed to the repo today — the README is the source of truth.)

## Validation

`leadContextService.fetchLeadContext` validates only what is required to keep the page from crashing:

1. `response.ok` — else throw `Error("Failed to load dresses (status N)")`.
2. JSON parses — else throw `Error("Invalid JSON from server")`.
3. `body.items` is an array — else throw.

`body.user` is **not** validated. It is passed through as-is and exposed as `LeadUser | null` (typed loosely). This permits the unknown-`record_id` case where Make.com may return `null`, and avoids fragility against future shape changes to fields the frontend doesn't consume yet.

Mapping `items[]` → `Dress[]`:

```ts
{
  id:       item.id,                          // top-level UUID
  name:     item.data?.name,                  // string
  imageUrl: item.data?.picture || undefined,  // null/empty → undefined
}
```

Items missing `id` or `data.name` are filtered out (defensive — never crash the page over one bad row, just skip it). All other fields on the response are ignored.

## Page-load flow

```
URL: /?record_id=<uuid>
   │
   ▼
RequestPage mounts
   │
   ├─ recordId missing/empty?               ──► MissingRecordIdScreen
   ├─ VITE_MAKE_DRESSES_WEBHOOK_URL empty?  ──► MissingWebhookScreen
   ├─ VITE_MAKE_WEBHOOK_URL empty?          ──► MissingWebhookScreen
   │
   ▼
useEffect (dep: recordId, loadKey)
   │
   ├─ leadContextService.fetchLeadContext(recordId)  → { user, dresses }
   └─ orderLinesService.listAllOrderLines()           → reservations (mock)
   │
   ├─ either rejects?  ──► loadError = true → LoadFailedScreen (onRetry → loadKey++)
   ├─ both resolve, user === null  ──► LeadNotFoundScreen
   ├─ both resolve, user is object ──► render form with dresses + reservations
```

## Submit flow

Unchanged. `buildWebhookPayload` + `submitToWebhook` continue to POST to `VITE_MAKE_WEBHOOK_URL`. This change does not touch any submission code.

## Testing

### New tests

**`src/services/leadContextService.test.ts`**

- ✅ Happy path with a real-shape response (3 dresses, with `__IMTINDEX__` junk and null `picture`); asserts `dresses` mapping (id, name, imageUrl undefined) and `user` returned as-is.
- ✅ POSTs to the configured URL with `{ record_id }` body and `application/json` header.
- ✅ HTTP 500 → throws.
- ✅ HTTP 200 with non-array `items` → throws.
- ✅ HTTP 200 with malformed JSON → throws.
- ✅ Item missing `id` or `data.name` → that one item is skipped, others returned.
- ✅ Item with non-empty `data.picture` → maps to `imageUrl`.
- ✅ HTTP 200 with `user: null` and `items: []` → returns `{ user: null, dresses: [] }` without throwing (unknown `record_id` case).

**`src/components/LeadNotFoundScreen.test.tsx`**

- ✅ Renders the Hebrew "ליד לא נמצא" headline and the body text.

**`src/components/DressCombobox.test.tsx`**

- ✅ Renders the dresses passed via prop.
- ✅ Filters client-side by typed query (substring, case-insensitive).
- ✅ Selecting an option calls `onChange` with the matching dress.

### Updated tests

**`src/pages/RequestPage.test.tsx`**

- Replace any mock of `dressesService` with a mock of `leadContextService`.
- Add: when the webhook fetch rejects, `LoadFailedScreen` renders.
- Add: clicking "נסו שוב" re-attempts the fetch.
- Add: when the webhook resolves with `user: null`, `LeadNotFoundScreen` renders and the form does not appear.

### Manual checklist (added to README)

- Open `/?record_id=7bfde42c-5d00-49bd-9de3-9094e5d0f0ea` → form renders with the 3 real CRM dresses (כתומה / ורודה / אדומה).
- Open the combobox → all 3 visible. Type "ור" → only "שמלה ורודה" remains.
- Open with an unknown `record_id` (e.g., `00000000-0000-0000-0000-000000000000`) → `LeadNotFoundScreen` renders ("ליד לא נמצא"), form does not appear.
- Temporarily point `VITE_MAKE_DRESSES_WEBHOOK_URL` at a 500 endpoint → reload → `LoadFailedScreen`. Restore env, click "נסו שוב" → page recovers.
- Remove `VITE_MAKE_DRESSES_WEBHOOK_URL` from `.env.local` → reload → `MissingWebhookScreen`.

## Migration order

The plan that follows this spec will execute in this order so the app is runnable at each step:

1. Add `LeadUser` / `LeadContext` types to `src/types/domain.ts`.
2. Add `leadContextService` + tests.
3. Add `LoadFailedScreen` component.
4. Add `LeadNotFoundScreen` component + test.
5. Refactor `DressCombobox` to take `dresses` prop (pure controlled).
6. Forward `dresses` through `DressRow` to `DressCombobox`.
7. Wire `RequestPage` to `leadContextService`; add load-error and lead-not-found branches.
8. Delete `dressesService.ts` and `MOCK_DRESSES`.
9. Update existing tests, add new ones.
10. Update `README.md` (new env var + manual checklist).
11. Run typecheck + full vitest + manual smoke against the real webhook.

## Risks

- The webhook returns leftover Make.com fields (`__IMTINDEX__`, top-level `name: null`, `email: null` on each item). The mapping is field-by-field and ignores extras, but if Make.com later changes which key holds the dress name (currently `item.data.name`), the page will silently fall back to no-name and items will be filtered out by the defensive guard. The unit tests pin the field path, so a real change will surface as a test failure rather than a silent breakage in production.
- The submit webhook URL and the dresses webhook URL are now both required. A user who upgrades and only sets one will see `MissingWebhookScreen` until both are set. README clearly documents this.

## Out of scope

- Server-side dress search (the catalog is small enough to filter client-side).
- Active-status filtering on the frontend (Make.com handles it).
- Using `daily_price`, `dress_type_label`, `picture` rendering, or any other field beyond `id` + `name`. These can be added later without changing the service shape.
- Reading reservations from the webhook. Mocked reservations stay until that's a separate, intentional change.
- Displaying `user` info in the UI. Stored in state, unused, ready for follow-up work.
