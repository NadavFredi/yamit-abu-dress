# Yamit Abu — בקשות השכרת שמלות

External Hebrew RTL website used by EasyFlow customers to submit dress
rental/reservation requests. The site is opened from a button inside EasyFlow
with a customer record id passed in the URL:

```
https://NEW_WEBSITE_DOMAIN/?record_id={{record_id}}
```

The customer picks one or more dresses with date ranges, and on submit the
payload is POSTed to a Make.com webhook. Make.com is responsible for creating
the actual order rows inside EasyFlow — this site never writes to the EasyFlow
database directly.

### Integration model with EasyFlow

| Direction | How | What |
|---|---|---|
| Read | Site → Make.com webhook → EasyFlow | Lead + active dresses for the customer (keyed by `record_id`) |
| Write | Site → Make.com webhook → EasyFlow | New rental request; Make.com creates the order rows |
| EasyFlow itself | Untouched | No schema changes, no code changes inside EasyFlow |

The site never talks to EasyFlow directly. All reads go through the dresses
webhook (load-time fetch keyed by `record_id`); all writes go through the
submit webhook. EasyFlow itself is untouched.

## Stack

- Vite + React 19 + TypeScript
- Tailwind CSS + shadcn-style UI primitives + Radix
- react-router-dom, react-hook-form (deps installed for future use)
- date-fns
- Vitest + @testing-library/react for tests

## Run

```bash
npm install
cp .env.example .env.local
# fill in VITE_MAKE_WEBHOOK_URL (submit) and VITE_MAKE_DRESSES_WEBHOOK_URL (load) in .env.local
npm run dev
```

Then open `http://localhost:5173/?record_id=rec_demo_123`.

The site requires two Make.com webhook URLs:

- `VITE_MAKE_WEBHOOK_URL` — receives new rental requests on submit.
- `VITE_MAKE_DRESSES_WEBHOOK_URL` — called on page load with `{ record_id }`,
  returns `{ user, items }` (lead + active dresses) for that customer.

If `record_id` is missing or empty, the user sees a Hebrew error screen and
cannot submit.

If either `VITE_MAKE_WEBHOOK_URL` or `VITE_MAKE_DRESSES_WEBHOOK_URL` is
missing, a Hebrew configuration error screen is shown instead of the form.

## Test

```bash
npm run test          # vitest, runs once
npm run test:watch    # vitest in watch mode
npm run typecheck     # tsc --noEmit
npm run build         # type-checked production build
```

## Architecture

```
src/
  lib/
    dateOverlap.ts     # pure overlap function (inclusive)
    validation.ts      # form-level + row-level submission validation
    webhook.ts         # builds the Make.com payload and POSTs it
    utils.ts           # cn() classname helper
  services/
    leadContextService.ts   # POSTs record_id to Make.com, returns { user, dresses }
    orderLinesService.ts    # interface + mock impl (listAllOrderLines, byDress)
    mockData.ts             # hard-coded reservations for development
  types/domain.ts            # Dress, OrderLine, DressSelection, WebhookPayload, LeadUser, LeadContext
  components/
    ui/                      # Button, Input, Label, Card, Select, Alert
    DressRow.tsx             # one dress + start + end + remove
    DressCombobox.tsx        # client-side filtered dress picker
    MissingRecordIdScreen.tsx
    MissingWebhookScreen.tsx
    LoadFailedScreen.tsx     # webhook fetch failed; "נסו שוב"
    LeadNotFoundScreen.tsx   # "ליד לא נמצא" (user === null)
  pages/
    RequestPage.tsx          # main form
    ThankYouPage.tsx         # success page (Hebrew confirmation + summary)
  App.tsx                    # routes
  main.tsx                   # entry, BrowserRouter, sonner Toaster
  index.css                  # Tailwind + tokens
```

### Availability validation

Two ranges overlap when:

```
existing_start <= selected_end AND existing_end >= selected_start
```

`hasConflict(dressId, start, end, orderLines)` checks the selection against
all order lines for the same dress. Conflicts on a different dress do not
block.

`validateSubmission` runs the full set of checks per the spec:

- record_id present
- at least one dress selected
- each row has a dress, start date, end date
- end date not before start date
- no overlap with existing order lines for that dress
- duplicate dress in the same submission is blocked

### Submission flow

1. Validate locally; show inline Hebrew errors per row + a top-level alert.
2. Build payload: `{ customer_record_id, selected_dresses[], submission_timestamp, source }`.
3. POST JSON to `VITE_MAKE_WEBHOOK_URL`.
4. On 2xx → navigate to `/thank-you` with a summary in router state.
5. On error → toast with the message; the user can retry.

### Webhook payload shape

```json
{
  "customer_record_id": "rec_123",
  "selected_dresses": [
    {
      "dress_id": "dress-001",
      "dress_name": "שמלת ערב כחולה",
      "start_date": "2026-12-01",
      "end_date": "2026-12-05"
    }
  ],
  "submission_timestamp": "2026-05-07T10:00:00.000Z",
  "source": "yamit-abu-dress-website"
}
```

## Reads and writes — both via Make.com

Reads (lead + dress catalog) go through `VITE_MAKE_DRESSES_WEBHOOK_URL`.
Writes (rental requests) go through `VITE_MAKE_WEBHOOK_URL`. The frontend
never talks to EasyFlow directly.

`MOCK_ORDER_LINES` (existing reservations) is still hard-coded in
`src/services/mockData.ts`. To wire that up to real data, either expand the
dresses-webhook response to include reservations, or add a third Make.com
webhook for them and replace `MockOrderLinesService`.

## Manual test checklist

- Open `/` (no record_id) → Hebrew "missing record_id" screen.
- Open `/?record_id=` (empty) → same screen.
- Open `/?record_id=7bfde42c-5d00-49bd-9de3-9094e5d0f0ea` → form renders with
  the live CRM dresses.
- Open the dress combobox → all dresses visible. Type part of a name → list
  filters live (case-insensitive substring).
- Open with an unknown record_id (e.g., `00000000-0000-0000-0000-000000000000`)
  → `LeadNotFoundScreen` ("ליד לא נמצא") renders, form does not appear.
- Temporarily point `VITE_MAKE_DRESSES_WEBHOOK_URL` at a non-existent host or
  a 500 endpoint → reload → `LoadFailedScreen`. Restore env, click "נסו שוב"
  → page recovers.
- Remove `VITE_MAKE_DRESSES_WEBHOOK_URL` from `.env.local` → reload → "תצורה
  חסרה" screen.
- Remove `VITE_MAKE_WEBHOOK_URL` from `.env.local` → reload → "תצורה חסרה"
  screen.
- Pick a dress, set start + end → submit → thank-you page with summary.
- Click "הוספת שמלה נוספת" twice → three rows. Remove the middle one.
- Pick the same dress twice → duplicate error.
- Pick start > end → "תאריך הסיום מוקדם מתאריך ההתחלה".

## What we did NOT touch

- The EasyFlow repo, schema, or production system — never modified by this
  project. EasyFlow is only consumed via its existing API (read-only) and via
  Make.com (for writes).
- No direct order creation: order rows are created by Make.com after the
  webhook fires.
