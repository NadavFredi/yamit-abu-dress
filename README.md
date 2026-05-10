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
| Read | Site → EasyFlow API (direct, **read-only** token) | Dress catalog + existing reservations to compute availability |
| Write | Site → Make.com webhook → EasyFlow | New rental request; Make.com creates the order rows |
| EasyFlow itself | Untouched | No schema changes, no code changes inside EasyFlow |

The site holds a read-only EasyFlow API token. It cannot create, update, or
delete anything in EasyFlow directly — every write goes through Make.com.

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
# fill in VITE_MAKE_WEBHOOK_URL in .env.local
npm run dev
```

Then open `http://localhost:5173/?record_id=rec_demo_123`.

If `record_id` is missing or empty, the user sees a Hebrew error screen and
cannot submit.

If `VITE_MAKE_WEBHOOK_URL` is missing, a Hebrew configuration error screen is
shown instead of the form.

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
    dressesService.ts       # interface + mock impl (listDresses)
    orderLinesService.ts    # interface + mock impl (listAllOrderLines, byDress)
    mockData.ts             # hard-coded dresses + reservations for development
  types/domain.ts            # Dress, OrderLine, DressSelection, WebhookPayload
  components/
    ui/                      # Button, Input, Label, Card, Select, Alert
    DressRow.tsx             # one dress + start + end + remove
    MissingRecordIdScreen.tsx
    MissingWebhookScreen.tsx
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

## Switching from mock data to the EasyFlow API later

The service layer is the only seam that needs to change. To wire up real reads:

1. Add `VITE_EASYFLOW_API_URL` and `VITE_EASYFLOW_API_TOKEN` (**read-only**) to `.env.local`.
2. Replace `MockDressesService` with an EasyFlow-backed implementation that calls
   the read-only endpoints for the dress catalog (used by `listDresses` and
   the dropdown's debounced `searchDresses`).
3. Replace `MockOrderLinesService` with an EasyFlow-backed implementation that
   reads existing reservations / order lines for availability calculation.
4. The rest of the app (validation, UI, webhook) does not need to change.
5. Writes still go through Make.com — do not add EasyFlow write calls here.

## Manual test checklist

- Open `/` (no record_id) → Hebrew "missing record_id" screen.
- Open `/?record_id=` (empty) → same screen.
- Open `/?record_id=rec_123` → form renders with one empty row.
- Select dress, set start + end → submit → thank-you page with summary.
- Click "הוספת שמלה נוספת" twice → three rows. Remove the middle one.
- Pick the same dress twice → duplicate error.
- Pick start > end → "תאריך הסיום מוקדם מתאריך ההתחלה".
- Pick `dress-001` (mock data) with `2026-06-03` → `2026-06-08` → conflict
  error (overlaps the seeded `2026-06-01..2026-06-05` reservation).
- Pick `dress-005` with the same dates → submits cleanly (no reservations on
  `dress-005` in mock data).
- Remove `VITE_MAKE_WEBHOOK_URL` from `.env.local` → on next reload, "תצורה
  חסרה" screen renders.

## What we did NOT touch

- The EasyFlow repo, schema, or production system — never modified by this
  project. EasyFlow is only consumed via its existing API (read-only) and via
  Make.com (for writes).
- No direct order creation: order rows are created by Make.com after the
  webhook fires.
