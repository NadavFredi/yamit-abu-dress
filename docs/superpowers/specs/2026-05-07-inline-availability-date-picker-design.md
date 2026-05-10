# Inline Availability in the Date Picker — Design

## Context

Today, the rental request form (`RequestPage` → `DressRow`) lets the user pick a dress and then pick start and end dates from a calendar that always shows every date as available. Only **after** both dates are chosen does the form check the chosen range against existing bookings and reveal a red "השמלה אינה זמינה" message.

This forces the user into trial-and-error: pick two dates, see the error, change a date, see another error, etc.

**Goal:** show booked dates directly inside the calendar, so the user can see availability *while picking* and avoid invalid combinations entirely.

## Approved decisions (from brainstorming)

1. Booked dates are **disabled** (greyed out, unclickable), and a small **legend** is shown at the bottom of the calendar.
2. The end-date picker also disables any date that would create a range **crossing** an existing booking.
3. Date pickers are **disabled until a dress is selected** (a hint replaces the existing reservations list).
4. **Past dates** are also disabled.

## Architecture

The calendar component stays generic. It accepts:

- `dateState?: (iso: string) => "past" | "booked" | null` — `null` (or no callback) means the day is enabled and styled normally; any non-null value means the day is disabled and styled per its kind.
- `legend?: React.ReactNode` — content rendered below the day grid.

`DatePicker` passes those through. `DressRow` builds `dateState` from the selected dress, the booking list, the chosen start date, and today.

This keeps all business rules (what counts as "past", "booked", "crossing a booking") in one place outside the UI primitives, and keeps the calendar reusable.

## Disable rules (precise)

Let `bookings = orderLines.filter(l => l.dressId === dressId)`.

Let `todayIso` = today's date in `yyyy-mm-dd` (local time, matching `DatePicker.toISO`).

- `isPast(iso)` → `iso < todayIso`
- `isBooked(iso)` → some `b ∈ bookings` where `b.startDate <= iso <= b.endDate`
- `crossesBooking(start, end)` → some `b ∈ bookings` where `rangesOverlap(b.startDate, b.endDate, start, end)` (reuse existing `rangesOverlap` from `src/lib/dateOverlap.ts`)

**Start picker disables:** `isPast(iso) || isBooked(iso)`
**End picker disables:** `isPast(iso) || iso < startDate || (startDate !== "" && crossesBooking(startDate, iso))`

If the dress is not chosen, the date picker is fully disabled (closed trigger), so the predicate is irrelevant for that case.

## Component changes

### `src/components/ui/calendar.tsx`

- Add optional props: `dateState?: (iso: string) => "past" | "booked" | null` and `legend?: React.ReactNode`.
- For each day cell, compute `state = dateState?.(iso) ?? null`.
  - If `state === null`: render as today (interactive).
  - If `state === "booked"`: render `<button>` with `aria-disabled="true"`, `data-disabled="true"`, `data-disabled-kind="booked"`, no `onClick`, no hover, classes `text-red-400 line-through bg-red-50/40 cursor-not-allowed`.
  - If `state === "past"`: same but `data-disabled-kind="past"`, classes `text-muted-foreground/40 cursor-not-allowed`.
- Render `legend` below the day grid when provided.
- The "today" border style still applies even on disabled days, so it's visible.
- The month/year selection views are unaffected.

### `src/components/ui/date-picker.tsx`

- Add pass-through props: `dateState`, `legend`.
- Existing `disabled` prop already disables the trigger button — keep as-is. When `disabled`, the popover cannot be opened.

### `src/lib/datePickerRules.ts` (new)

Pure helpers, easy to unit-test:

```ts
export type DateState = "past" | "booked" | null;

export function buildStartDateState(
  bookings: OrderLine[],
  todayIso: string
): (iso: string) => DateState;

export function buildEndDateState(
  bookings: OrderLine[],
  todayIso: string,
  startDate: string // "" if not yet chosen
): (iso: string) => DateState;

export function todayIsoLocal(now?: Date): string; // matches DatePicker.toISO
```

For end-date state, dates that cross a booking are returned as `"booked"` (the user sees them as red because they would conflict). Dates `< startDate` are returned as `"past"` (greyed out, not red — they're just unreachable, not in conflict).

### `src/components/DressRow.tsx`

- Compute `bookings = orderLines.filter(l => l.dressId === value.dressId)` (already done as `reservationsForDress`).
- Compute `todayIso = todayIsoLocal()` once.
- If `!value.dressId`:
  - Pass `disabled={true}` to both `DatePicker`s.
  - Replace the bookings hint block with a small hint: `"בחרו שמלה תחילה כדי לצפות בזמינות"` styled like the existing reservations hint.
- If dress is chosen:
  - `startState = buildStartDateState(bookings, todayIso)` → pass as `dateState` to start `DatePicker`.
  - `endState = buildEndDateState(bookings, todayIso, value.startDate)` → pass as `dateState` to end `DatePicker`.
  - Keep the existing reservations hint block (the textual list of booked ranges) — it's still useful as a quick reference.
- Pass a small legend node:
  ```tsx
  <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm bg-red-200 ring-1 ring-red-300" />
      תפוס
    </span>
    <span className="flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-sm bg-muted ring-1 ring-border" />
      תאריך עבר
    </span>
  </div>
  ```

### Edge case: changing start after end is set

We do **not** auto-clear the end date when start moves. If the new start makes the existing end invalid, the existing red "השמלה אינה זמינה" status block already catches it (via `computeLiveStatus` → `findConflicts`). This avoids surprising the user by silently wiping their choice.

## Visuals

- **Booked day**: `text-red-400 line-through bg-red-50/40` background, no hover, `aria-disabled="true"`.
- **Past day**: `text-muted-foreground/40` foreground, no background tint, `aria-disabled="true"`.
- **Legend**: thin top border separator, two small swatches with Hebrew labels, RTL-friendly.
- **Selected day** styling beats both — `selected` should not apply to a disabled day in the first place because the user can't click it.

## Testing

### `src/lib/datePickerRules.test.ts` (new)

- `buildStartDateState`: returns `"past"` for `iso < todayIso`, `"booked"` for `iso` inside any booking, `null` otherwise.
- `buildEndDateState` with empty `startDate`: returns `"past"` for `iso < todayIso`, otherwise `null` (no booking-related disabling without a start).
- `buildEndDateState` with `startDate` set: returns `"past"` for `iso < startDate` (or `iso < todayIso`), `"booked"` for any `iso` where `[startDate, iso]` crosses a booking — including the canonical "Jun 1 + Jun 10 around a Jun 5–7 booking" case (Jun 10 is not itself booked but creates a crossing).
- `todayIsoLocal` returns `yyyy-mm-dd` in local time, matching `DatePicker.toISO` (test with a fixed `Date`).

### `src/pages/RequestPage.test.tsx` (additions)

- When no dress is selected, both date trigger buttons have `disabled` and `aria-disabled`.
- After selecting a dress with a known booking, opening the start-date picker and finding the booked day shows `data-disabled="true"`. Clicking it does not change the selection (the popover stays open and value remains empty).
- After selecting a dress, picking a start date that is *before* an existing booking, opening the end-date picker, the day on the *far side* of the booking shows `data-disabled="true"`.

### `src/test/datePickerHelpers.ts` (update)

- Extend `pickDate` (or add `expectDateDisabled`) to assert `data-disabled` so tests can check disabled days without clicking them.

## Files touched

- `src/components/ui/calendar.tsx` (modify)
- `src/components/ui/date-picker.tsx` (modify)
- `src/components/DressRow.tsx` (modify)
- `src/lib/datePickerRules.ts` (new)
- `src/lib/datePickerRules.test.ts` (new)
- `src/pages/RequestPage.test.tsx` (modify)
- `src/test/datePickerHelpers.ts` (modify)

## Out of scope

- Range-style date picker (single popover that picks start and end together) — bigger rework, not requested.
- Hover-preview of the "would-be range" while the user moves the cursor over the end calendar.
- Any change to the webhook payload, validation, or `dateOverlap` semantics. Existing logic is reused.
