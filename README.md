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
npm run dev
```

Then open `http://localhost:5173/?record_id=rec_demo_123`.

Runtime configuration is hard-coded in `src/lib/appConfig.ts`. It includes the
Make.com webhook URLs and the login credentials used by the frontend.

- Submit webhook — receives new rental requests on submit and
  creates the final order in Make.com / EasyFlow. Current URL:
  `https://hook.eu1.make.com/575kvx5nq2uk61mmc7mnv3bdibeyq44y`.
- Dresses webhook — called on page load with `{ record_id }`,
  returns `{ user, items }` (lead + active dresses) for that customer.
- Reservations webhook — called when the user picks a
  dress with `{ dress_id, dress_name }`, returns `{ orders }` (existing
  reservations for that dress, used to disable booked dates in the calendar).
  Cached client-side per dress id for the lifetime of the page.

If `record_id` is missing or empty, the user sees a Hebrew error screen and
cannot submit.

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
    appConfig.ts       # hard-coded webhooks and login credentials
    dateOverlap.ts     # pure overlap function (inclusive)
    validation.ts      # form-level + row-level submission validation
    webhook.ts         # builds the Make.com payload and POSTs it
    utils.ts           # cn() classname helper
  services/
    leadContextService.ts        # POSTs record_id to Make.com, returns { user, dresses }
    dressReservationsService.ts  # POSTs { dress_id, dress_name }, returns OrderLine[]
  types/domain.ts            # Dress, OrderLine, DressSelection, WebhookPayload, LeadUser, LeadContext
  components/
    ui/                      # Button, Input, Label, Card, Select, Alert
    DressRow.tsx             # one dress + start + end + remove
    DressCombobox.tsx        # client-side filtered dress picker
    LeadInfoHeader.tsx       # name + phone banner at the top of the page
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
3. POST JSON to the submit webhook from `src/lib/appConfig.ts`.
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

## Reads and writes — all via Make.com

The frontend never talks to EasyFlow directly. Three webhooks cover all I/O:

- **Lead + dresses** (page load): dresses webhook from `src/lib/appConfig.ts` ←
  `{ record_id }` → `{ user, items }`
- **Reservations per dress** (on selection): reservations webhook from
  `src/lib/appConfig.ts`
  ← `{ dress_id, dress_name }` → `{ orders: [...] }`. Cached client-side per
  dress id; no refetch on duplicate selections.
- **Submit** (on form submit): submit webhook from `src/lib/appConfig.ts` ←
  rental request payload → 2xx triggers EasyFlow order creation in Make.com.

## Manual test checklist

- Open `/` (no record_id) → Hebrew "missing record_id" screen.
- Open `/?record_id=` (empty) → same screen.
- Open `/?record_id=7bfde42c-5d00-49bd-9de3-9094e5d0f0ea` → form renders with
  the live CRM dresses, and the lead's name + phone show in the banner above.
- Open the dress combobox → all dresses visible. Type part of a name → list
  filters live (case-insensitive substring).
- Pick a dress → "טוען זמינות..." appears briefly, then the date pickers
  un-disable and existing reservations show as red/disabled days.
- Pick the same dress in two rows → only one reservations webhook call fires
  (cached). Verify in Make.com history or Network tab.
- Open with an unknown record_id (e.g., `00000000-0000-0000-0000-000000000000`)
  → `LeadNotFoundScreen` ("ליד לא נמצא") renders, form does not appear.
- Temporarily point the dresses webhook in `src/lib/appConfig.ts` at a
  non-existent host or a 500 endpoint → reload → `LoadFailedScreen`. Restore
  the URL, click "נסו שוב" → page recovers.
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
