# Inline Availability in the Date Picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show booked, past, and range-crossing dates as disabled (with a legend) directly inside the calendar in `RequestPage`, so the user sees availability while picking instead of after.

**Architecture:** Calendar component is given a generic `dateState` callback returning `"past" | "booked" | null`. `DatePicker` passes it through. `DressRow` builds the callback from the selected dress's bookings, the chosen start date, and today, using pure helpers in `src/lib/datePickerRules.ts`. When no dress is chosen, both date pickers are disabled.

**Tech Stack:** React 19, TypeScript, Tailwind, Radix Popover, Vitest, React Testing Library, `date-fns` already in deps.

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/lib/datePickerRules.ts` | new | Pure helpers building `dateState` callbacks for start/end pickers |
| `src/lib/datePickerRules.test.ts` | new | Unit tests for the rules |
| `src/components/ui/calendar.tsx` | modify | Render disabled days based on `dateState`, render `legend` slot |
| `src/components/ui/date-picker.tsx` | modify | Pass-through `dateState` and `legend` props |
| `src/components/DressRow.tsx` | modify | Build start/end `dateState`, pass to pickers, render legend, disable pickers when no dress chosen |
| `src/test/datePickerHelpers.ts` | modify | Add `expectDateDisabled(iso, kind)` helper |
| `src/pages/RequestPage.test.tsx` | modify | Anchor system time, fix the existing "no dress" test, add tests for the new behavior |

---

## Task 1: Pure rules — `datePickerRules.ts`

**Files:**
- Create: `src/lib/datePickerRules.ts`
- Test: `src/lib/datePickerRules.test.ts`

This is a pure-logic task. We TDD it before touching any UI.

- [ ] **Step 1: Write failing tests for `todayIsoLocal`**

Create `src/lib/datePickerRules.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildEndDateState,
  buildStartDateState,
  todayIsoLocal,
} from "./datePickerRules";
import type { OrderLine } from "@/types/domain";

describe("todayIsoLocal", () => {
  it("returns yyyy-mm-dd in local time matching the DatePicker format", () => {
    const fixed = new Date(2026, 4, 7, 10, 30); // 7 May 2026 local
    expect(todayIsoLocal(fixed)).toBe("2026-05-07");
  });

  it("zero-pads month and day", () => {
    const fixed = new Date(2026, 0, 3, 23, 59); // 3 Jan 2026 local
    expect(todayIsoLocal(fixed)).toBe("2026-01-03");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run src/lib/datePickerRules.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the file with `todayIsoLocal` only**

Create `src/lib/datePickerRules.ts`:

```ts
import type { OrderLine } from "@/types/domain";
import { rangesOverlap } from "@/lib/dateOverlap";

export type DateState = "past" | "booked" | null;

export function todayIsoLocal(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function buildStartDateState(
  bookings: OrderLine[],
  todayIso: string
): (iso: string) => DateState {
  return (iso) => {
    if (iso < todayIso) return "past";
    for (const b of bookings) {
      if (b.startDate <= iso && iso <= b.endDate) return "booked";
    }
    return null;
  };
}

export function buildEndDateState(
  bookings: OrderLine[],
  todayIso: string,
  startDate: string
): (iso: string) => DateState {
  return (iso) => {
    if (iso < todayIso) return "past";
    if (startDate && iso < startDate) return "past";
    if (startDate) {
      for (const b of bookings) {
        if (rangesOverlap(b.startDate, b.endDate, startDate, iso)) {
          return "booked";
        }
      }
    } else {
      for (const b of bookings) {
        if (b.startDate <= iso && iso <= b.endDate) return "booked";
      }
    }
    return null;
  };
}
```

- [ ] **Step 4: Run the tests to confirm `todayIsoLocal` passes**

Run: `npx vitest run src/lib/datePickerRules.test.ts`
Expected: PASS for both `todayIsoLocal` cases.

- [ ] **Step 5: Add failing tests for `buildStartDateState`**

Append to `src/lib/datePickerRules.test.ts`:

```ts
const TODAY = "2026-05-07";

const bookings: OrderLine[] = [
  { id: "ol-1", dressId: "d", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol-2", dressId: "d", startDate: "2026-07-15", endDate: "2026-07-20" },
];

describe("buildStartDateState", () => {
  it("returns 'past' for dates before today", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-05-06")).toBe("past");
    expect(state("2025-12-31")).toBe("past");
  });

  it("returns null for today itself", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state(TODAY)).toBe(null);
  });

  it("returns 'booked' for any day inside an existing booking, including endpoints", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-06-01")).toBe("booked");
    expect(state("2026-06-03")).toBe("booked");
    expect(state("2026-06-05")).toBe("booked");
    expect(state("2026-07-15")).toBe("booked");
    expect(state("2026-07-20")).toBe("booked");
  });

  it("returns null for future dates outside any booking", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-05-31")).toBe(null);
    expect(state("2026-06-06")).toBe(null);
    expect(state("2026-12-25")).toBe(null);
  });

  it("returns null for every date when there are no bookings", () => {
    const state = buildStartDateState([], TODAY);
    expect(state("2026-06-03")).toBe(null);
    expect(state("2026-07-17")).toBe(null);
  });
});
```

- [ ] **Step 6: Run the tests to confirm `buildStartDateState` passes**

Run: `npx vitest run src/lib/datePickerRules.test.ts`
Expected: all `buildStartDateState` cases PASS.

- [ ] **Step 7: Add failing tests for `buildEndDateState`**

Append to `src/lib/datePickerRules.test.ts`:

```ts
describe("buildEndDateState", () => {
  it("with empty startDate, returns 'past' for past dates and 'booked' for booked dates", () => {
    const state = buildEndDateState(bookings, TODAY, "");
    expect(state("2026-05-06")).toBe("past");
    expect(state("2026-06-03")).toBe("booked");
    expect(state("2026-06-06")).toBe(null);
  });

  it("with startDate set, returns 'past' for dates before the start date", () => {
    const state = buildEndDateState(bookings, TODAY, "2026-06-10");
    expect(state("2026-06-09")).toBe("past");
    expect(state("2026-06-10")).toBe(null);
  });

  it("with startDate before a booking, returns 'booked' for any end date that crosses the booking", () => {
    // booking 2026-06-01..2026-06-05, start 2026-05-20
    const state = buildEndDateState(bookings, TODAY, "2026-05-20");
    expect(state("2026-05-31")).toBe(null); // doesn't cross
    expect(state("2026-06-01")).toBe("booked"); // hits start of booking
    expect(state("2026-06-03")).toBe("booked"); // inside booking
    expect(state("2026-06-05")).toBe("booked"); // hits end of booking
    expect(state("2026-06-10")).toBe("booked"); // span Jun 1-5 booking — even though Jun 10 is free
    expect(state("2026-07-14")).toBe("booked"); // still spans booking
  });

  it("with startDate equal to today, treats today as a valid (null) end date", () => {
    const state = buildEndDateState(bookings, TODAY, TODAY);
    expect(state(TODAY)).toBe(null);
  });

  it("with no bookings, only 'past' is ever returned", () => {
    const state = buildEndDateState([], TODAY, "2026-06-10");
    expect(state("2026-06-09")).toBe("past");
    expect(state("2026-06-15")).toBe(null);
    expect(state("2027-01-01")).toBe(null);
  });
});
```

- [ ] **Step 8: Run the full rules test file**

Run: `npx vitest run src/lib/datePickerRules.test.ts`
Expected: ALL tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/lib/datePickerRules.ts src/lib/datePickerRules.test.ts
git commit -m "feat: add date picker rules helpers"
```

---

## Task 2: Calendar — `dateState` and `legend`

**Files:**
- Modify: `src/components/ui/calendar.tsx`

The calendar starts rendering disabled days (different style, `data-disabled`, `aria-disabled`, native `disabled`) and accepts a legend slot. Behavior is opt-in: without props, no visual change.

- [ ] **Step 1: Update `CalendarProps` and add the imports**

Open `src/components/ui/calendar.tsx`. Replace the imports block (lines 1–4) with:

```tsx
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { DateState } from "@/lib/datePickerRules";
```

Replace the `CalendarProps` interface (currently lines 8–15) with:

```tsx
export interface CalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  showOutsideDays?: boolean;
  /** Returns a non-null kind for disabled days; null/undefined means enabled. */
  dateState?: (iso: string) => DateState;
  /** Optional legend rendered below the day grid. */
  legend?: React.ReactNode;
}
```

Update the `Calendar` function signature destructuring (currently around line 89–97) to include the new props:

```tsx
export function Calendar({
  className,
  selected,
  onSelect,
  month,
  onMonthChange,
  showOutsideDays = true,
  dateState,
  legend,
  ...props
}: CalendarProps) {
```

- [ ] **Step 2: Update the day cell renderer to honor `dateState`**

Replace the day-grid block (currently lines 233–256, the `<div className="mt-1 grid grid-cols-7 gap-1">...</div>`) with:

```tsx
<div className="mt-1 grid grid-cols-7 gap-1">
  {days.map(({ date, outside }) => {
    const iso = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const state = dateState?.(iso) ?? null;
    const disabled = state !== null;
    return (
      <button
        key={iso}
        type="button"
        aria-label={iso}
        disabled={disabled}
        aria-disabled={disabled || undefined}
        data-disabled={disabled ? "true" : undefined}
        data-disabled-kind={state ?? undefined}
        className={cn(
          "flex h-9 items-center justify-center rounded-md text-sm transition-colors",
          !disabled &&
            "hover:bg-accent hover:text-accent-foreground",
          outside && !disabled && "text-muted-foreground/50",
          isSameDay(date, today) && "border border-primary/30",
          !disabled &&
            isSameDay(date, selected) &&
            "bg-primary text-primary-foreground hover:bg-primary/90",
          state === "booked" &&
            "text-red-400 line-through bg-red-50/40 cursor-not-allowed",
          state === "past" &&
            "text-muted-foreground/40 cursor-not-allowed"
        )}
        onClick={() => {
          if (disabled) return;
          onSelect?.(date);
        }}
      >
        {date.getDate()}
      </button>
    );
  })}
</div>
```

- [ ] **Step 3: Render the legend below the day grid**

Locate the `view === "days" ? (...) : null` block. Replace its closing fragment so it renders the legend after the day grid. Specifically replace:

```tsx
      {view === "days" ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
```

(Keep the structure inside.) Then change the closing of that block from:

```tsx
        </>
      ) : null}
```

to:

```tsx
          {legend ? <div className="mt-3">{legend}</div> : null}
        </>
      ) : null}
```

(The day-grid `<div>` already closes before this; we just append the legend wrapper inside the same fragment.)

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS — no type errors.

- [ ] **Step 5: Run all existing tests to confirm no regression**

Run: `npm test`
Expected: ALL existing tests PASS (no behavior change without props).

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/calendar.tsx
git commit -m "feat(calendar): add dateState predicate and legend slot"
```

---

## Task 3: DatePicker — pass-through

**Files:**
- Modify: `src/components/ui/date-picker.tsx`

Plumbing only. No new behavior, no test.

- [ ] **Step 1: Add the new props and pass them through**

Open `src/components/ui/date-picker.tsx`. Replace the entire `DatePickerProps` interface (currently lines 11–18) with:

```tsx
import type { DateState } from "@/lib/datePickerRules";

interface DatePickerProps {
  id?: string;
  value: string; // ISO yyyy-mm-dd, or "" when empty
  onChange: (next: string) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
  dateState?: (iso: string) => DateState;
  legend?: React.ReactNode;
}
```

(Place the `import type` line near the other imports at the top of the file.)

Update the `DatePicker` function signature destructuring (currently around lines 44–51) to include the new props:

```tsx
export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "בחרו תאריך",
  "aria-invalid": ariaInvalid,
  disabled,
  dateState,
  legend,
}: DatePickerProps) {
```

Update the `<Calendar />` invocation inside `<PopoverContent>` (currently lines 73–80) to:

```tsx
<Calendar
  selected={selected}
  dateState={dateState}
  legend={legend}
  onSelect={(date) => {
    if (!date) return;
    onChange(toISO(date));
    setOpen(false);
  }}
/>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: ALL tests PASS (still no behavior change without props).

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/date-picker.tsx
git commit -m "feat(date-picker): pass through dateState and legend"
```

---

## Task 4: Test helper — `expectDateDisabled`

**Files:**
- Modify: `src/test/datePickerHelpers.ts`

A small assertion helper used by the new integration tests. Open the calendar, navigate to the target month, look up the day button, and assert `data-disabled` and optionally `data-disabled-kind`.

- [ ] **Step 1: Add the helper**

Open `src/test/datePickerHelpers.ts`. After the existing `pickDate` function, append:

```ts
export async function expectDateDisabled(
  user: User,
  trigger: HTMLElement,
  iso: string,
  expectedKind?: "past" | "booked"
): Promise<void> {
  await user.click(trigger);

  const calendar = await screen.findByTestId("calendar");

  const targetMonth = iso.slice(0, 7);

  let safety = 60;
  while (safety > 0) {
    const current = calendar.getAttribute("data-current-month");
    if (current === targetMonth) break;
    const direction = (current ?? "") < targetMonth ? "next" : "prev";
    const button = within(calendar).getByRole("button", {
      name: direction === "next" ? /חודש הבא/ : /חודש קודם/,
    });
    await user.click(button);
    safety -= 1;
  }

  await waitFor(() => {
    expect(calendar.getAttribute("data-current-month")).toBe(targetMonth);
  });

  const dayButton = within(calendar).getByRole("button", { name: iso });
  expect(dayButton).toHaveAttribute("data-disabled", "true");
  if (expectedKind) {
    expect(dayButton).toHaveAttribute("data-disabled-kind", expectedKind);
  }
}

export async function closeDatePicker(user: User): Promise<void> {
  // Close any open popover by pressing Escape.
  await user.keyboard("{Escape}");
}
```

The `closeDatePicker` helper is for tests that open a calendar to inspect it but then need to interact with another field. (`pickDate` already closes the popover by selecting a day; this is needed only for the inspection cases.)

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/test/datePickerHelpers.ts
git commit -m "test: add expectDateDisabled helper"
```

---

## Task 5: DressRow — wire up rules and disable states

**Files:**
- Modify: `src/components/DressRow.tsx`

This is the integration step. Both date pickers become disabled until a dress is chosen; once chosen, they receive `dateState` and a legend.

- [ ] **Step 1: Add imports**

Open `src/components/DressRow.tsx`. Replace the existing imports near the top (lines 1–18) with:

```tsx
import { useMemo } from "react";
import { Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { findConflicts } from "@/lib/dateOverlap";
import {
  buildEndDateState,
  buildStartDateState,
  todayIsoLocal,
} from "@/lib/datePickerRules";
import type {
  Dress,
  DressSelection,
  OrderLine,
  ValidationError,
} from "@/types/domain";
```

- [ ] **Step 2: Define a `Legend` component above `DressRow`**

Just before the `DressRow` function definition (currently line 69), insert:

```tsx
function CalendarLegend() {
  return (
    <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm bg-red-200 ring-1 ring-red-300"
        />
        תפוס
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm bg-muted ring-1 ring-border"
        />
        תאריך עבר
      </span>
    </div>
  );
}
```

- [ ] **Step 3: Compute the date states inside `DressRow`**

Inside `DressRow`, after the line `const reservationsForDress = ...` (currently around lines 94–96), add:

```tsx
const todayIso = useMemo(() => todayIsoLocal(), []);
const dressChosen = Boolean(value.dressId);
const startDateState = useMemo(
  () =>
    dressChosen
      ? buildStartDateState(reservationsForDress, todayIso)
      : undefined,
  [dressChosen, reservationsForDress, todayIso]
);
const endDateState = useMemo(
  () =>
    dressChosen
      ? buildEndDateState(reservationsForDress, todayIso, value.startDate)
      : undefined,
  [dressChosen, reservationsForDress, todayIso, value.startDate]
);
```

- [ ] **Step 4: Pass the new props to both `DatePicker`s and disable them when no dress is chosen**

Replace the start `DatePicker` block (currently lines 148–155) with:

```tsx
<DatePicker
  id={startId}
  value={value.startDate}
  onChange={(next) => onChange({ ...value, startDate: next })}
  aria-invalid={Boolean(errorsByField.start)}
  disabled={!dressChosen}
  dateState={startDateState}
  legend={dressChosen ? <CalendarLegend /> : undefined}
/>
```

Replace the end `DatePicker` block (currently lines 165–170) with:

```tsx
<DatePicker
  id={endId}
  value={value.endDate}
  onChange={(next) => onChange({ ...value, endDate: next })}
  aria-invalid={Boolean(errorsByField.end || errorsByField.range)}
  disabled={!dressChosen}
  dateState={endDateState}
  legend={dressChosen ? <CalendarLegend /> : undefined}
/>
```

- [ ] **Step 5: Replace the bookings hint with a "pick a dress first" hint when none is chosen**

Replace the existing bookings hint block (currently lines 185–195) with:

```tsx
{value.dressId ? (
  reservationsForDress.length > 0 ? (
    <div
      className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
      data-testid={`reservations-hint-${index}`}
    >
      <span className="font-medium">תאריכים תפוסים לשמלה זו:</span>{" "}
      {reservationsForDress
        .map((l) => `${l.startDate} עד ${l.endDate}`)
        .join(" · ")}
    </div>
  ) : null
) : (
  <div
    className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
    data-testid={`pick-dress-hint-${index}`}
  >
    בחרו שמלה תחילה כדי לצפות בזמינות
  </div>
)}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 7: Run the full test suite to see what currently breaks**

Run: `npm test`
Expected: ONE failure — `RequestPage > blocks submission when no dress is selected`. The test calls `pickDate` before a dress is selected, but the trigger is now `disabled` so the popover never opens and `findByTestId("calendar")` times out. We fix this in Task 6.

If any OTHER tests fail, stop and investigate before proceeding. (Reservations-hint test should still pass because dress-001 is selected before that hint is asserted.)

- [ ] **Step 8: Commit**

```bash
git add src/components/DressRow.tsx
git commit -m "feat(dress-row): inline availability in date pickers"
```

---

## Task 6: Update RequestPage tests for the new behavior

**Files:**
- Modify: `src/pages/RequestPage.test.tsx`

We need to:
1. Anchor system time so the existing future-dated tests don't drift into "past" once real time moves on (we just added past-date disabling).
2. Fix the broken `blocks submission when no dress is selected` test.
3. Add new tests covering: pickers disabled with no dress, hint visible, booked day shown disabled, end-picker disables crossing dates, past dates disabled.

- [ ] **Step 1: Anchor system time in the existing `RequestPage` describe block**

Open `src/pages/RequestPage.test.tsx`. In the first `describe("RequestPage", ...)` block, replace the existing `beforeEach` and `afterEach` (currently lines 30–41) with:

```tsx
const FIXED_NOW = new Date(2026, 4, 1, 12, 0, 0); // 1 May 2026 local

beforeEach(() => {
  vi.useFakeTimers({ now: FIXED_NOW, shouldAdvanceTime: true });
  vi.stubEnv("VITE_MAKE_WEBHOOK_URL", "https://hook.example.com/test");
  globalThis.fetch = vi.fn(async () =>
    ({ ok: true, status: 200 } as Response)
  );
});

afterEach(() => {
  vi.useRealTimers();
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
```

`shouldAdvanceTime: true` is needed so that user-event's internal timers keep moving; without it, tests hang.

- [ ] **Step 2: Fix the broken "blocks submission when no dress is selected" test**

Find the test starting `it("blocks submission when no dress is selected", ...)` (currently around lines 179–193). Replace its body with:

```tsx
const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
renderApp("/?record_id=rec_123");

await screen.findByLabelText(/^שמלה$/);

// With the new design, date pickers are disabled until a dress is chosen.
expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();

await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

expect(
  await screen.findByText(/יש לבחור שמלה/)
).toBeInTheDocument();
expect(globalThis.fetch).not.toHaveBeenCalled();
```

(The `userEvent.setup({ advanceTimers })` form is required when fake timers are used.)

- [ ] **Step 3: Update every other `userEvent.setup()` call in this file to advance fake timers**

Search the file for `userEvent.setup()`. Replace each occurrence with:

```tsx
userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
```

(There are roughly 10 such calls — update all of them.)

- [ ] **Step 4: Run the existing tests to confirm they all pass again**

Run: `npm test`
Expected: ALL existing tests PASS.

If any test fails because its picked dates are now in the past relative to `FIXED_NOW = 2026-05-01`, leave them alone — every existing test uses dates from 2026-06 onward, which are after the fixed date.

- [ ] **Step 5: Add a test for the "pick dress first" hint and disabled triggers**

Inside the `describe("RequestPage", ...)` block, alongside the other tests, add:

```tsx
it("disables both date pickers and shows a hint until a dress is selected", async () => {
  renderApp("/?record_id=rec_123");

  await screen.findByLabelText(/^שמלה$/);

  expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
  expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();
  expect(screen.getByTestId("pick-dress-hint-0")).toHaveTextContent(
    /בחרו שמלה תחילה/
  );
});
```

- [ ] **Step 6: Add a test that booked days are visible-but-disabled in the calendar**

Add `expectDateDisabled` to the import on line 8:

```tsx
import { expectDateDisabled, pickDate } from "@/test/datePickerHelpers";
```

Then add this test inside the same `describe`:

```tsx
it("marks dates that overlap an existing reservation as disabled in the start-date picker", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp("/?record_id=rec_123");

  await screen.findByLabelText(/^שמלה$/);
  await pickFromSelect(
    user,
    screen.getByLabelText(/^שמלה$/),
    DRESS_NAMES["dress-001"]
  );

  // dress-001 has a booking 2026-06-01..2026-06-05
  await expectDateDisabled(
    user,
    screen.getByLabelText(/תאריך התחלה/),
    "2026-06-03",
    "booked"
  );
});
```

- [ ] **Step 7: Add a test that past dates are disabled**

```tsx
it("marks dates before today as disabled in the start-date picker", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp("/?record_id=rec_123");

  await screen.findByLabelText(/^שמלה$/);
  await pickFromSelect(
    user,
    screen.getByLabelText(/^שמלה$/),
    DRESS_NAMES["dress-001"]
  );

  // FIXED_NOW is 2026-05-01; 2026-04-15 is in the past.
  await expectDateDisabled(
    user,
    screen.getByLabelText(/תאריך התחלה/),
    "2026-04-15",
    "past"
  );
});
```

- [ ] **Step 8: Add a test that the end-date picker disables dates which would cross a booking**

```tsx
it("marks end dates that would cross an existing booking as disabled", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  renderApp("/?record_id=rec_123");

  await screen.findByLabelText(/^שמלה$/);
  await pickFromSelect(
    user,
    screen.getByLabelText(/^שמלה$/),
    DRESS_NAMES["dress-001"]
  );

  // dress-001 has a booking 2026-06-01..2026-06-05.
  // Pick start before the booking; end on the far side should be disabled.
  await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-05-20");

  await expectDateDisabled(
    user,
    screen.getByLabelText(/תאריך סיום/),
    "2026-06-10",
    "booked"
  );
});
```

- [ ] **Step 9: Run the full test suite**

Run: `npm test`
Expected: ALL tests PASS, including the 4 new ones.

- [ ] **Step 10: Run typecheck and lint**

Run: `npx tsc -b && npm run lint`
Expected: both PASS.

- [ ] **Step 11: Commit**

```bash
git add src/pages/RequestPage.test.tsx
git commit -m "test(request-page): cover inline date-picker availability"
```

---

## Task 7: Manual smoke test in the browser

**Files:** none

The integration tests cover behavior, but we still want to eyeball the visual output (legend, color contrast, RTL).

- [ ] **Step 1: Start the dev server**

Run (in a separate terminal): `npm run dev`
Expected: Vite reports a local URL (usually `http://localhost:5173`).

- [ ] **Step 2: Open the form with a record id**

Navigate to `http://localhost:5173/?record_id=rec_test` in a browser.

Expected:
- Date pickers are greyed out / disabled.
- Below them, a small hint "בחרו שמלה תחילה כדי לצפות בזמינות" appears.

- [ ] **Step 3: Pick "שמלת ערב כחולה" (dress-001) from the select**

Expected:
- Both date pickers become enabled.
- The reservations hint reappears with "תאריכים תפוסים לשמלה זו:" and the booked ranges.

- [ ] **Step 4: Open the start-date picker and navigate to June 2026**

Expected:
- Days 1–5 of June 2026 are red, struck-through, and unclickable.
- Below the day grid, a legend shows "🟥 תפוס" and a grey square "תאריך עבר".
- Days before today (1 May 2026) are greyed out and unclickable.
- Other days remain interactive and selectable.

- [ ] **Step 5: Pick start = 20 May 2026, then open the end-date picker**

Expected:
- Days before 20 May are greyed out (past relative to start).
- Days 1–5 of June 2026 AND every day from 6 June onward (until they land outside the crossing range) are marked booked.
  - Specifically: 6 June through any later date in June or beyond will create a range crossing the 1–5 booking — those days are red.
- Day 31 May is interactive (range 20-May–31-May does not cross the booking).

- [ ] **Step 6: Stop the dev server and confirm there are no console errors**

Press Ctrl+C in the dev-server terminal.

- [ ] **Step 7: Commit any incidental fixes (none expected)**

If the smoke test surfaces a visual issue, fix it and commit. Otherwise no commit needed.

---

## Self-Review

**Spec coverage:**
- Disabled booked dates with legend → Tasks 2 + 5.
- End-picker disables range-crossing dates → Task 1 (`buildEndDateState`) + Task 5.
- Pickers disabled until a dress is chosen + hint → Task 5, verified in Task 6.
- Past dates disabled → Task 1 + Task 6 (test).
- Edge case "changing start after end is set keeps existing red error" → no change needed (existing `computeLiveStatus` handles it); covered implicitly because we don't touch that code.

**Placeholder scan:** no TBD/TODO; every code step contains complete code.

**Type consistency:** `DateState` is defined once in `datePickerRules.ts`, imported by `calendar.tsx` and `date-picker.tsx`. `buildStartDateState` / `buildEndDateState` / `todayIsoLocal` are referenced consistently. `dateState` prop name is used end to end.
