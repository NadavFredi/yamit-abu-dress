# Per-Dress Notes and Wider Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional multi-line "notes" field to every dress row in the rental request form, send those notes through the existing webhook, and widen the request page from `max-w-3xl` to `max-w-6xl` on desktop.

**Architecture:**
- Extend the `DressSelection` and `WebhookDressPayload` types with an optional `notes` field (`notes?: string` in state, `notes: string | null` on the wire — `null` when blank).
- Add a new shadcn-style `Textarea` UI primitive mirroring the existing `Input`.
- Render the textarea inside `DressRow` between the 4-column grid and the availability status messages — always visible, full width, no validation.
- Replace `max-w-3xl` with `max-w-6xl` on the request page container.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind + shadcn-style UI primitives + Vitest + React Testing Library.

**Spec:** [docs/superpowers/specs/2026-05-16-per-dress-notes-and-wider-layout-design.md](../specs/2026-05-16-per-dress-notes-and-wider-layout-design.md)

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `src/types/domain.ts` | Modify | Add `notes?: string` to `DressSelection`, `notes: string \| null` to `WebhookDressPayload` |
| `src/components/ui/textarea.tsx` | **Create** | shadcn-style `Textarea` primitive (mirrors `input.tsx`) |
| `src/components/ui/textarea.test.tsx` | **Create** | Basic unit tests for the new primitive |
| `src/lib/webhook.ts` | Modify | Map `sel.notes` → `notes: string \| null` in payload |
| `src/lib/webhook.test.ts` | Modify | Cover blank / whitespace / non-empty `notes` cases |
| `src/components/DressRow.tsx` | Modify | Render notes textarea between 4-col grid and availability status |
| `src/components/DressRow.test.tsx` | Modify | Cover textarea rendering, change forwarding, enabled-from-start |
| `src/pages/RequestPage.tsx` | Modify | `emptySelection()` adds `notes: ""`, container becomes `max-w-6xl` |

No existing test fixture needs updating — `notes` is optional on the type. New tests assert the optional path.

The user does not allow `git commit` on this project — they handle commits manually. The **"Commit"** step at the end of each task therefore reads "Verify build + tests are green and pause for the user to commit." Do not run `git commit` yourself.

---

## Task 1: Extend the domain types

**Files:**
- Modify: `src/types/domain.ts`

- [ ] **Step 1: Add `notes?: string` to `DressSelection`**

Update [src/types/domain.ts](../../../src/types/domain.ts) so the interface looks exactly like this (keep the other fields in their existing order):

```ts
export interface DressSelection {
  dressId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes?: string;
}
```

- [ ] **Step 2: Add `notes: string | null` to `WebhookDressPayload`**

In the same file, update the interface:

```ts
export interface WebhookDressPayload {
  dress_id: string;
  dress_name: string | null;
  start_date: string;
  end_date: string;
  quantity: number;
  notes: string | null;
}
```

- [ ] **Step 3: Run typecheck to verify no callers break**

Run: `npm run typecheck`

Expected: exits 0. `notes?: string` on `DressSelection` keeps existing fixtures valid. `notes: string | null` on `WebhookDressPayload` will cause TypeScript to complain about `buildWebhookPayload` not emitting the field — that's the next task. **If typecheck fails only on `src/lib/webhook.ts`, that's expected. Anything else means a fixture needs updating; stop and re-check.**

- [ ] **Step 4: Pause for commit**

Suggested commit message:

```
feat(types): add optional notes to DressSelection and WebhookDressPayload
```

Hand control back. Do not run `git commit`.

---

## Task 2: Serialize notes in `buildWebhookPayload`

**Files:**
- Modify: `src/lib/webhook.ts`
- Test: `src/lib/webhook.test.ts`

- [ ] **Step 1: Add a failing test for blank notes → `null`**

Append to the `describe("buildWebhookPayload", ...)` block in [src/lib/webhook.test.ts](../../../src/lib/webhook.test.ts):

```ts
it("sets notes to null when notes is missing", () => {
  const payload = buildWebhookPayload({
    recordId: "rec_123",
    selections: [
      { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
    ],
    dresses,
    now: new Date(),
  });
  expect(payload.selected_dresses[0].notes).toBeNull();
});

it("sets notes to null when notes is empty or whitespace", () => {
  const payload = buildWebhookPayload({
    recordId: "rec_123",
    selections: [
      { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1, notes: "   " },
    ],
    dresses,
    now: new Date(),
  });
  expect(payload.selected_dresses[0].notes).toBeNull();
});

it("trims and forwards non-empty notes", () => {
  const payload = buildWebhookPayload({
    recordId: "rec_123",
    selections: [
      { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1, notes: "  needs hemming  " },
    ],
    dresses,
    now: new Date(),
  });
  expect(payload.selected_dresses[0].notes).toBe("needs hemming");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- src/lib/webhook.test.ts`

Expected: the three new tests FAIL because the current implementation does not emit `notes`. Existing tests may also start failing because the new `WebhookDressPayload` type requires `notes` and the existing `expect(payload.selected_dresses).toEqual([{...}])` assertions don't include it.

That's expected — Task 2 also fixes the existing assertions.

- [ ] **Step 3: Update existing assertions in `webhook.test.ts` to expect `notes: null`**

Find the two `expect(payload.selected_dresses).toEqual([...])` assertions (the "maps each selection into the dress payload" test) and add `notes: null` to each object literal. The block becomes:

```ts
expect(payload.selected_dresses).toEqual([
  {
    dress_id: "d1",
    dress_name: "שמלת ערב כחולה",
    start_date: "2026-07-01",
    end_date: "2026-07-05",
    quantity: 1,
    notes: null,
  },
  {
    dress_id: "d2",
    dress_name: "שמלת חתונה לבנה",
    start_date: "2026-08-01",
    end_date: "2026-08-03",
    quantity: 1,
    notes: null,
  },
]);
```

- [ ] **Step 4: Implement `notes` serialization in `buildWebhookPayload`**

Replace the body of `buildWebhookPayload` in [src/lib/webhook.ts](../../../src/lib/webhook.ts) with:

```ts
export function buildWebhookPayload({
  recordId,
  selections,
  dresses,
  now,
}: BuildPayloadInput): WebhookPayload {
  const dressNameById = new Map(dresses.map((d) => [d.id, d.name]));

  const selected_dresses: WebhookDressPayload[] = selections.map((sel) => {
    const trimmedNotes = (sel.notes ?? "").trim();
    return {
      dress_id: sel.dressId,
      dress_name: dressNameById.get(sel.dressId) ?? null,
      start_date: sel.startDate,
      end_date: sel.endDate,
      quantity: sel.quantity,
      notes: trimmedNotes === "" ? null : trimmedNotes,
    };
  });

  return {
    customer_record_id: recordId,
    selected_dresses,
    submission_timestamp: now.toISOString(),
    source: "yamit-abu-dress-website",
  };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- src/lib/webhook.test.ts`

Expected: every test in the file passes.

- [ ] **Step 6: Run the full test suite + typecheck**

Run: `npm test`
Then: `npm run typecheck`

Expected: both exit 0.

- [ ] **Step 7: Pause for commit**

Suggested message: `feat(webhook): serialize per-dress notes (trim + null when blank)`. Hand control back.

---

## Task 3: Add a `Textarea` UI primitive

**Files:**
- Create: `src/components/ui/textarea.tsx`
- Create: `src/components/ui/textarea.test.tsx`

- [ ] **Step 1: Write the failing test for the new primitive**

Create `src/components/ui/textarea.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Textarea } from "./textarea";

describe("Textarea", () => {
  it("renders a textarea element with the provided value", () => {
    render(<Textarea value="hello" onChange={() => {}} />);
    const el = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(el.tagName).toBe("TEXTAREA");
    expect(el.value).toBe("hello");
  });

  it("forwards typing to onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Textarea value="" onChange={onChange} />);
    await user.type(screen.getByRole("textbox"), "x");
    expect(onChange).toHaveBeenCalled();
  });

  it("merges custom className with default styles", () => {
    render(<Textarea value="" onChange={() => {}} className="custom-x" />);
    const el = screen.getByRole("textbox");
    expect(el.className).toMatch(/custom-x/);
    expect(el.className).toMatch(/rounded-md/);
  });

  it("supports the disabled attribute", () => {
    render(<Textarea value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/components/ui/textarea.test.tsx`

Expected: FAIL with a module-not-found error (`Cannot find module './textarea'`).

- [ ] **Step 3: Implement `Textarea` mirroring `Input`**

Create `src/components/ui/textarea.tsx`. Mirror the existing pattern in [src/components/ui/input.tsx](../../../src/components/ui/input.tsx):

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- src/components/ui/textarea.test.tsx`

Expected: all four tests pass.

- [ ] **Step 5: Run the full test suite + typecheck**

Run: `npm test && npm run typecheck`

Expected: both green.

- [ ] **Step 6: Pause for commit**

Suggested message: `feat(ui): add shadcn-style Textarea primitive`. Hand control back.

---

## Task 4: Render the notes textarea inside `DressRow`

**Files:**
- Modify: `src/components/DressRow.tsx`
- Test: `src/components/DressRow.test.tsx`

- [ ] **Step 1: Write the failing tests for notes UI behavior**

Append three tests to the existing `describe("DressRow", ...)` block in [src/components/DressRow.test.tsx](../../../src/components/DressRow.test.tsx):

```tsx
it("renders an optional notes textarea labeled 'הערות' that is enabled before a dress is picked", () => {
  renderRow();
  const notes = screen.getByLabelText(/הערות/);
  expect(notes.tagName).toBe("TEXTAREA");
  expect(notes).not.toBeDisabled();
});

it("forwards notes changes through onChange while preserving other fields", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderRow({
    value: { dressId: "dress-1", startDate: "2026-06-20", endDate: "2026-06-22", quantity: 1 },
    onChange,
  });

  await user.type(screen.getByLabelText(/הערות/), "a");

  const lastCall = onChange.mock.calls.at(-1)?.[0];
  expect(lastCall).toMatchObject({
    dressId: "dress-1",
    startDate: "2026-06-20",
    endDate: "2026-06-22",
    quantity: 1,
    notes: "a",
  });
});

it("renders the current notes value when provided", () => {
  renderRow({
    value: {
      dressId: "dress-1",
      startDate: "",
      endDate: "",
      quantity: 1,
      notes: "needs hemming",
    },
  });
  const notes = screen.getByLabelText(/הערות/) as HTMLTextAreaElement;
  expect(notes.value).toBe("needs hemming");
});
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `npm test -- src/components/DressRow.test.tsx`

Expected: the three new tests FAIL (no textbox / no label match).

- [ ] **Step 3: Import `Textarea` in `DressRow.tsx`**

In [src/components/DressRow.tsx](../../../src/components/DressRow.tsx), add to the imports near the top:

```ts
import { Textarea } from "@/components/ui/textarea";
```

- [ ] **Step 4: Add a `notesId` constant alongside the existing ids**

Inside the `DressRow` function body, locate the existing block:

```ts
const dressId = `dress-${index}`;
const startId = `start-${index}`;
const endId = `end-${index}`;
const qtyId = `qty-${index}`;
```

Add a fifth line:

```ts
const notesId = `notes-${index}`;
```

- [ ] **Step 5: Render the notes block between the 4-column grid and the availability status**

In the JSX, find the closing `</div>` of the `<div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-4">` block and the existing `{errorsByField.range?.map(...)}` that follows it.

Immediately **after** the closing `</div>` of that grid (and after the `errorsByField.range?.map(...)` block — keep range errors in their current location), insert this new section just **before** the `{!value.dressId && ( ... pick-dress-hint ...)}` block:

```tsx
<div className="space-y-1.5">
  <Label htmlFor={notesId}>הערות (אופציונלי)</Label>
  <Textarea
    id={notesId}
    rows={3}
    value={value.notes ?? ""}
    onChange={(e) => onChange({ ...value, notes: e.target.value })}
  />
</div>
```

Placement summary inside the JSX of `DressRow`:

```
<div className="space-y-4 rounded-lg border bg-card p-3 sm:p-4">
  <div className="flex items-center justify-between gap-3">...header...</div>

  <div className="grid ... md:grid-cols-2 lg:grid-cols-4">...4 fields...</div>

  {errorsByField.range?.map(...)}

  <!-- NEW: notes section -->
  <div className="space-y-1.5">
    <Label htmlFor={notesId}>הערות (אופציונלי)</Label>
    <Textarea ... />
  </div>
  <!-- END NEW -->

  {!value.dressId && (...pick-dress hint...)}
  {value.dressId && isReservationsLoading && (...loading hint...)}
  {liveStatus.kind === "available" && (...green box...)}
  {liveStatus.kind === "unavailable" && (...red box...)}
</div>
```

- [ ] **Step 6: Run the DressRow tests to verify they pass**

Run: `npm test -- src/components/DressRow.test.tsx`

Expected: all tests in `DressRow.test.tsx` pass, including the three new ones.

- [ ] **Step 7: Run the full suite + typecheck**

Run: `npm test && npm run typecheck`

Expected: both green.

- [ ] **Step 8: Pause for commit**

Suggested message: `feat(dress-row): add optional per-dress notes textarea`. Hand control back.

---

## Task 5: Initialize `notes` in `emptySelection()` and widen the page

**Files:**
- Modify: `src/pages/RequestPage.tsx`

- [ ] **Step 1: Initialize `notes` in `emptySelection()`**

In [src/pages/RequestPage.tsx](../../../src/pages/RequestPage.tsx), update the existing factory:

```ts
const emptySelection = (): DressSelection => ({
  dressId: "",
  startDate: "",
  endDate: "",
  quantity: 1,
  notes: "",
});
```

- [ ] **Step 2: Change the container width from `max-w-3xl` to `max-w-6xl`**

In the same file, find the outer container in the render output:

```tsx
<div className="mx-auto w-full max-w-3xl px-3 sm:px-4">
```

Replace with:

```tsx
<div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
```

This is the only width change in the codebase — do not touch `LoginPage.tsx`, `ThankYouPage.tsx`, or `LeadInfoHeader.tsx`.

- [ ] **Step 3: Run the full test suite + typecheck**

Run: `npm test && npm run typecheck`

Expected: both green. No test asserts on the literal `max-w-*` class, so widening should not break anything.

- [ ] **Step 4: Run the build to catch any production-only issues**

Run: `npm run build`

Expected: build succeeds.

- [ ] **Step 5: Manual smoke check**

Run: `npm run dev`. Open the request page with a valid `record_id` query string. Verify:

1. The form container is visibly wider than before on a desktop viewport (≥1152 px).
2. On a narrow viewport (drag the window to <640 px width), the layout is unchanged from before.
3. Every dress row shows a labelled `הערות (אופציונלי)` textarea below the four main fields and above the availability status box.
4. Typing in the notes textarea is allowed even before a dress is picked.
5. Pick a dress + dates, type a note, submit the form, and confirm in the browser DevTools Network panel that the POST body includes `"notes": "<your text>"` for that line. Then submit a second time with an empty note and confirm the payload has `"notes": null`.

If any of (1)–(5) fails, fix and re-run the manual smoke check. Do not move on with a partial result.

- [ ] **Step 6: Pause for commit**

Suggested message: `feat(request-page): widen container to max-w-6xl and seed notes default`. Hand control back.

---

## Self-Review

**Spec coverage:**
- Data model (`DressSelection`, `WebhookDressPayload`) — Task 1.
- `emptySelection()` initialization — Task 5.
- Webhook serialization (trim + null) — Task 2.
- New `Textarea` primitive — Task 3.
- Notes UI placement inside `DressRow` (below 4-col grid, above availability) — Task 4.
- Width change `max-w-3xl` → `max-w-6xl` — Task 5.
- Unit tests for `Textarea`, `DressRow` notes behavior, webhook serialization — Tasks 2, 3, 4.
- Manual smoke check (desktop wider, mobile unchanged, notes round-trip through webhook) — Task 5.
- No validation entry added (notes is optional/unconstrained) — by omission across all tasks ✔.
- No other pages widened — explicitly excluded in Task 5 ✔.

**Placeholder scan:** No "TODO", "TBD", "add error handling", or hand-wavy steps. All code blocks are complete and copy-pastable.

**Type consistency:**
- `DressSelection.notes` is `notes?: string` everywhere.
- `WebhookDressPayload.notes` is `string | null` everywhere.
- `Textarea` exported name matches the import path in Task 4.
- `notesId` naming is consistent (`notes-${index}`) and matches the corresponding `<Label htmlFor>`.

No issues found.

---

**Plan complete and saved to** `docs/superpowers/plans/2026-05-16-per-dress-notes-and-wider-layout.md`.
