# Per-Dress Reservations Webhook — Design

## Context

Until now, existing reservations (used to disable booked dates in the calendar) were mocked in `MOCK_ORDER_LINES`. A new Make.com webhook now returns the live reservations for a given dress:

```
POST https://hook.eu1.make.com/ulbgfyoqc6d7mca6m6skhbs3t1dsep73
{ "dress_id": "<uuid>", "dress_name": "<string>" }
→ { "orders": [ { id, data: { dress, start_rent_date, end_rent_date, ... }, ... } ] }
```

The site moves from "load all reservations once on page mount" to "fetch reservations per dress, on selection, with a per-dress cache". Mock reservations are deleted entirely.

## Approved decisions

1. **Request body**: `{ dress_id, dress_name }` (snake_case, matching the submit webhook style).
2. **Status filter**: none. Every order in `orders[]` is treated as blocking — Make.com is responsible for filtering server-side.
3. **Loading UX**: when a dress is selected and its reservations are still in flight, both date pickers are disabled and the row shows "טוען זמינות..." instead of the calendar legend.
4. **Delete `MOCK_ORDER_LINES`, `orderLinesService.ts`, and `mockData.ts`** — none of them are used after this change.
5. **Cache by dress id** for the lifetime of the page mount. If two rows pick the same dress, only one fetch. Failed fetches are not cached (so re-picking a different dress and back triggers a retry).

## Architecture

### New: `src/services/dressReservationsService.ts`

```ts
export async function fetchDressReservations(
  webhookUrl: string,
  dressId: string,
  dressName: string
): Promise<OrderLine[]>
```

POSTs `{ dress_id, dress_name }`. Validates `body.orders` is an array. Maps each order:

```ts
{
  id:        order.id,
  dressId:   order.data.dress,
  startDate: order.data.start_rent_date,
  endDate:   order.data.end_rent_date,
}
```

Skips orders missing required fields. Throws on HTTP non-OK, malformed JSON, or non-array `orders`.

### `RequestPage` state additions

```ts
const [dressReservations, setDressReservations] = useState<Map<string, OrderLine[]>>(new Map());
const [loadingDressIds, setLoadingDressIds] = useState<Set<string>>(new Set());
```

`updateRow` (and the initial selection event) invokes `ensureReservations(dressId, dressName)` whenever the row's dress changes to a non-empty value:

- If `dressReservations.has(dressId)` → no-op (cached).
- Else if `loadingDressIds.has(dressId)` → no-op (in flight).
- Else: add to `loadingDressIds`, fetch, then either populate `dressReservations` or toast on error; remove from `loadingDressIds` either way.

Initial mount no longer calls `orderLinesService.listAllOrderLines()` — there is no longer a global reservations fetch. The lead-context fetch is the only thing that runs on mount.

### Pass-through to `DressRow`

- `orderLines` prop continues to exist, but RequestPage builds it as `Array.from(dressReservations.values()).flat()`. Callers and validation stay unchanged because conflicts were always filtered by `dressId` inside.
- New prop `isReservationsLoading: boolean` — true when `loadingDressIds.has(value.dressId)`.

### `DressRow` change

When `value.dressId` is set AND `isReservationsLoading`:
- Pass `disabled` to both date pickers (override the existing `!dressChosen` rule).
- Render a "טוען זמינות..." hint in the same slot the "בחרו שמלה תחילה" hint occupies today. Suppress the calendar legend (the legend isn't meaningful while the data is loading).

### Env

New: `VITE_MAKE_DRESS_RESERVATIONS_WEBHOOK_URL`. Required. Missing → `MissingWebhookScreen` (same as the other two).

### Deleted

- `src/services/orderLinesService.ts`
- `src/services/mockData.ts` (file becomes empty after removing `MOCK_ORDER_LINES`; delete the file)

## Validation

In `dressReservationsService.fetchDressReservations`:
1. `response.ok` — else throw with status code.
2. JSON parses — else throw.
3. `body.orders` is an array — else throw.
4. Per-order: skip when `id`, `data.dress`, `data.start_rent_date`, or `data.end_rent_date` is not a string.

## Error handling

Fetch failure → `toast.error(...)`, no entry written to either map. The user can pick a different dress and back to retry. (We do not poison the cache with errors.)

## Testing

### New: `src/services/dressReservationsService.test.ts`

- POSTs the right URL + body `{ dress_id, dress_name }`.
- Maps a real-shape response (with the two-order sample, including `__IMTINDEX__` junk) to two `OrderLine`s.
- HTTP 500 → throws.
- Non-array `orders` → throws.
- Malformed JSON → throws.
- Order missing `data.dress` or dates → that order is skipped.
- Empty `orders: []` → returns `[]`.

### Updated: `src/pages/RequestPage.test.tsx`

- Add `RESERVATIONS_URL` constant; URL-aware fetch mock returns canned reservations per request `dress_id` in body.
- The default mock returns the same reservation set the old `MOCK_ORDER_LINES` had, keyed by dress id, so existing behavior tests (overlap detection, end-date crossing) continue to pass.
- New test: when the user picks a dress, the reservations webhook is called with `{ dress_id, dress_name }` (assert via the URL-aware mock).
- New test: picking the same dress twice in two rows fires the reservations webhook only **once**.
- New test: while a fetch is in flight, both date pickers are disabled and "טוען זמינות..." is visible.

### Removed

- Anything that imports `MOCK_ORDER_LINES` directly. (Currently only the deleted `orderLinesService.ts` and possibly the test fixture seed.)

## Migration order

1. Add `dressReservationsService` + tests.
2. Update `DressRow` to accept and render the loading state.
3. Update `RequestPage`: add cache + loading set, trigger fetch on selection, drop `orderLinesService`.
4. Delete `orderLinesService.ts` and `mockData.ts`.
5. Update `RequestPage.test.tsx` (URL-aware mock + new tests).
6. Update README (env var, architecture, manual checklist).
7. Typecheck + full test suite + build.

## Out of scope

- Persisting cache across page reloads.
- Refresh-on-focus or polling for live reservation changes.
- Server-side filtering rules (Make.com decides what counts as blocking).
- Per-row retry button on failure (toast + re-pick is the v1 affordance).
