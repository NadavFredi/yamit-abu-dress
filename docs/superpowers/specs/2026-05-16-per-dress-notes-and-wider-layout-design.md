# Per-Dress Notes and Wider Layout — Design

**Date:** 2026-05-16
**Status:** Draft for review

## Problem

Customers using the rental request form ([src/pages/RequestPage.tsx](../../../src/pages/RequestPage.tsx)) cannot attach any free-text context to a chosen dress (e.g., "needs hemming", "second dress is for the bridesmaid"). Staff reading the resulting webhook payload has no place to receive such notes.

The form itself currently lives in a `max-w-3xl` (768 px) container, which feels narrow on desktop — the 4-column dress-row grid (dress / quantity / start / end) is more cramped than it needs to be.

## Goals

1. Allow customers to attach an optional free-text note **to each dress** in the request.
2. Send those notes to the existing submission webhook so staff receive them with the rest of the order.
3. Widen the form container on desktop so the existing layout breathes; mobile must be unaffected.

## Non-goals

- No request-level (global) note — per-dress only.
- No character limit, counter, or rich-text formatting.
- No validation on the note (it is optional and unbounded).
- No redesign of other pages (Login, ThankYou, etc.). Only the request form changes width.
- No backend schema migration beyond the new key in the webhook payload.

## Design

### Data model

Add a `notes` field to the per-dress selection and to the webhook line item:

```ts
// src/types/domain.ts
export interface DressSelection {
  dressId: string;
  startDate: string;
  endDate: string;
  quantity: number;
  notes?: string;           // NEW. Optional on the type so existing test
                            //      fixtures keep compiling. The live app
                            //      always sets it to "" via emptySelection().
}

export interface WebhookDressPayload {
  dress_id: string;
  dress_name: string | null;
  start_date: string;
  end_date: string;
  quantity: number;
  notes: string | null;     // NEW. null when blank/undefined; trimmed string otherwise.
}
```

Reasoning: making `notes` optional on the type keeps the ~25 existing test fixtures (validation, webhook, DressRow tests) compiling untouched, since they have no opinion on notes. The runtime app always defines `notes` via `emptySelection()`, so the textarea remains a controlled input. Serializing to `string | null` in the webhook matches the existing convention used by `dress_name`.

### Initialization

`emptySelection()` in [src/pages/RequestPage.tsx](../../../src/pages/RequestPage.tsx) gains `notes: ""`.

### Webhook payload

`buildWebhookPayload` in [src/lib/webhook.ts](../../../src/lib/webhook.ts) trims `sel.notes`; if missing or empty after trimming, emits `null`. Otherwise emits the trimmed string.

```ts
const trimmedNotes = (sel.notes ?? "").trim();
return {
  // ...other fields...
  notes: trimmedNotes === "" ? null : trimmedNotes,
};
```

### UI — Notes field in `DressRow`

A new section is added inside [src/components/DressRow.tsx](../../../src/components/DressRow.tsx), placed:

- **After** the 4-column grid (dress / quantity / start / end).
- **Before** the availability status messages (`liveStatus.kind === "available" | "unavailable"`) and the "pick dress first" / "loading reservations" hints.

The notes field is **always visible**, full-width within the row card.

```
┌─ Dress row card ─────────────────────────────────────────┐
│ שמלה N                              [הסר]                │
│                                                           │
│ [Dress]  [Quantity]  [Start date]  [End date]            │
│                                                           │
│ הערות (אופציונלי)                                        │
│ ┌─────────────────────────────────────────────────────┐  │
│ │  <textarea rows={3}, resize-y>                       │  │
│ │                                                       │  │
│ │                                                       │  │
│ └─────────────────────────────────────────────────────┘  │
│                                                           │
│ ✓ השמלה זמינה לתאריכים שנבחרו  (or other status)         │
└──────────────────────────────────────────────────────────┘
```

Component details:

- Label: `הערות (אופציונלי)`.
- A new shadcn-style `Textarea` component is added at `src/components/ui/textarea.tsx`, mirroring the existing [src/components/ui/input.tsx](../../../src/components/ui/input.tsx) (same border, padding, focus ring, disabled styling). `rows={3}` default, `resize-y` so users can drag taller.
- Not disabled before a dress is picked. The notes field is available immediately, matching the "always visible" choice.
- `id={`notes-${index}`}` is attached to the textarea, with the `<Label htmlFor>` pointing at it for accessibility.
- The `onChange` handler updates `notes` via the existing `onChange` callback that already updates other fields of the `DressSelection`.

### Width change

[src/pages/RequestPage.tsx](../../../src/pages/RequestPage.tsx) container:

```diff
- <div className="mx-auto w-full max-w-3xl px-3 sm:px-4">
+ <div className="mx-auto w-full max-w-6xl px-3 sm:px-4">
```

`max-w-6xl` is 1152 px. The change has no effect below that viewport width (the constraint is a max), so mobile and small-tablet layouts are unaffected.

Other pages (`LoginPage`, `ThankYouPage`) are intentionally left at their current widths.

### Validation

No new validation. Notes are optional, unconstrained, and never produce a `ValidationError`. No new entry is added to the `ValidationError["code"]` union.

## Component boundaries

- `DressRow` owns the textarea rendering and forwards changes through its existing `onChange` prop. It does not know how the parent stores `notes`.
- `RequestPage` continues to be the single source of truth for `DressSelection[]`. It initializes the new field via `emptySelection()` and passes the selection unchanged into `DressRow`.
- `buildWebhookPayload` (pure function) is the only place that translates `notes: string` into `notes: string | null`.
- A new `Textarea` UI primitive ([src/components/ui/textarea.tsx](../../../src/components/ui/textarea.tsx)) is the only place that knows about textarea styling. `DressRow` consumes it.

Each unit can be understood and tested independently:

| Unit | Purpose | Depends on |
|---|---|---|
| `Textarea` | shadcn-style multi-line input primitive | `cn` util only |
| `DressRow` notes section | Renders label + textarea, forwards changes | `Textarea`, `Label`, the existing `value`/`onChange` |
| `emptySelection()` | Provides `notes: ""` default | nothing |
| `buildWebhookPayload` | Serializes `notes: string` → `notes: string \| null` | nothing |

## Testing

Unit tests:

1. **`src/components/ui/textarea.test.tsx`** (new, small) — renders, forwards `value`/`onChange`, applies `className`.
2. **[src/components/DressRow.test.tsx](../../../src/components/DressRow.test.tsx)** — extend:
   - Notes textarea is rendered with the correct label.
   - Typing into it fires `onChange` with the updated `notes` value while preserving the other `DressSelection` fields.
   - The textarea is **not** disabled when no dress is selected (verifies "always visible / always enabled").
3. **[src/lib/webhook.test.ts](../../../src/lib/webhook.test.ts)** — extend:
   - `notes: ""` (or whitespace) becomes `notes: null` in the payload.
   - `notes: "needs hemming  "` becomes `notes: "needs hemming"` (trimmed).
   - `notes: "a real note"` is passed through verbatim.

Manual smoke check after implementation:

- On desktop (≥1152 px), the form is wider and the four columns have more breathing room.
- On mobile (<640 px), the layout looks identical to before.
- Adding a note to one dress and submitting actually shows up in the webhook payload (verified via dev tools network panel).

## Rollout / migration

- The webhook consumer must tolerate the new `notes` key. If it rejects unknown fields, this needs to be coordinated with the webhook owner before deploy. **Assumption:** the consumer ignores unknown fields. If that turns out to be false, this is the only blocker.
- No data migration: the field is new and lives only on new submissions.

## Open questions

None at the time of writing. The design has been confirmed with the user across two iterations (data model, UI placement, width).
