# Load Dresses From Make.com Webhook — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **No git commits.** The user commits this project manually. Do NOT run `git commit` between tasks. The plan reflects this — there are no commit steps.

**Goal:** Replace the hard-coded `MockDressesService` with a live fetch from a Make.com webhook keyed by `record_id`. The webhook returns both the lead (`user`) and the active dresses (`items`). Show error/empty screens when the lead is missing or the call fails.

**Architecture:** A new free function `fetchLeadContext(webhookUrl, recordId)` POSTs `{ record_id }` to `VITE_MAKE_DRESSES_WEBHOOK_URL` and returns `{ user, dresses }`. `RequestPage` reads the env var and calls the function on mount; on success it renders the form (or `LeadNotFoundScreen` if `user === null`); on failure it renders `LoadFailedScreen` with retry. `DressCombobox` becomes a pure controlled component that receives the dress list as a prop.

**Tech Stack:** React 19, TypeScript, Tailwind, Vitest, React Testing Library, `fetch` (native).

**Spec:** [`docs/superpowers/specs/2026-05-10-dresses-webhook-load-design.md`](../specs/2026-05-10-dresses-webhook-load-design.md)

---

## File Structure

| File | Status | Responsibility |
|------|--------|----------------|
| `src/types/domain.ts` | modify | Add `LeadUser` and `LeadContext` types |
| `src/services/leadContextService.ts` | new | `fetchLeadContext(url, recordId)` + response mapping |
| `src/services/leadContextService.test.ts` | new | Unit tests for the fetcher (happy + error paths) |
| `src/components/LoadFailedScreen.tsx` | new | Hebrew load-error screen with `onRetry` button |
| `src/components/LeadNotFoundScreen.tsx` | new | Hebrew "ליד לא נמצא" full-screen message |
| `src/components/LeadNotFoundScreen.test.tsx` | new | Renders headline + body |
| `src/components/DressCombobox.tsx` | modify | Accept `dresses: Dress[]` prop; remove self-fetching, debounce, loading state; filter client-side |
| `src/components/DressRow.tsx` | modify | Forward existing `dresses` prop into `DressCombobox` |
| `src/pages/RequestPage.tsx` | modify | Read new env var; call `fetchLeadContext`; gate on `user`; render error screens |
| `src/pages/RequestPage.test.tsx` | modify | URL-aware fetch mock; add load-error and lead-not-found tests; new env stub |
| `src/services/dressesService.ts` | **delete** | Replaced by `leadContextService` |
| `src/services/mockData.ts` | modify | Remove `MOCK_DRESSES`; keep `MOCK_ORDER_LINES` |
| `README.md` | modify | Document `VITE_MAKE_DRESSES_WEBHOOK_URL`, update manual checklist |

---

## Task 1: Add `LeadUser` / `LeadContext` types

**Files:**
- Modify: `src/types/domain.ts`

- [ ] **Step 1: Append the new types**

Add at the bottom of `src/types/domain.ts`:

```ts
export interface LeadUser {
  id: string;
  entity_id: string;
  tenant_id: string;
  display_name: string | null;
  data: Record<string, unknown>;
  computed: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LeadContext {
  user: LeadUser | null;
  dresses: Dress[];
}
```

- [ ] **Step 2: Verify the project still typechecks**

Run: `npm run typecheck`
Expected: PASS (types are additive — nothing else uses them yet).

---

## Task 2: `leadContextService` — TDD

**Files:**
- Create: `src/services/leadContextService.ts`
- Test: `src/services/leadContextService.test.ts`

We TDD the service before any UI work.

- [ ] **Step 1: Write the failing test file**

Create `src/services/leadContextService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchLeadContext } from "./leadContextService";

const URL = "https://hook.example.com/dresses";

const okJson = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: async () => body,
  }) as unknown as Response;

const okText = (text: string) =>
  ({
    ok: true,
    status: 200,
    json: async () => {
      throw new SyntaxError("Unexpected token");
    },
    text: async () => text,
  }) as unknown as Response;

const realResponseSample = {
  user: {
    id: "7bfde42c-5d00-49bd-9de3-9094e5d0f0ea",
    entity_id: "8457cd25",
    tenant_id: "9722e0f4",
    display_name: "בדיקה",
    data: { phone: "+972526861485" },
    computed: {},
    created_at: "2026-05-07T06:36:21.393903+00:00",
    updated_at: "2026-05-09T19:05:11.707053+00:00",
  },
  items: [
    {
      id: "dfffa27b-6df8-4a31-a0ee-94a1a499143b",
      data: {
        name: "שמלה כתומה",
        status: "0",
        picture: null,
      },
      name: null,
      email: null,
      __IMTINDEX__: 1,
      __IMTLENGTH__: 3,
    },
    {
      id: "d956e6d3-2757-4003-a2d3-9904b01d485c",
      data: {
        name: "שמלה ורודה",
        status: "0",
        picture: "https://cdn.example.com/pink.jpg",
      },
      __IMTINDEX__: 2,
      __IMTLENGTH__: 3,
    },
    {
      id: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
      data: {
        name: "שמלה אדומה",
        status: "0",
        picture: null,
      },
      __IMTINDEX__: 3,
      __IMTLENGTH__: 3,
    },
  ],
};

describe("fetchLeadContext", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("POSTs JSON {record_id} to the configured URL", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: [] })
    );

    await fetchLeadContext(URL, "rec_abc");

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [calledUrl, init] = (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(calledUrl).toBe(URL);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    expect(JSON.parse(init?.body as string)).toEqual({ record_id: "rec_abc" });
  });

  it("maps a real-shape response to user + dresses", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson(realResponseSample)
    );

    const ctx = await fetchLeadContext(URL, "rec_abc");

    expect(ctx.user?.id).toBe("7bfde42c-5d00-49bd-9de3-9094e5d0f0ea");
    expect(ctx.dresses).toHaveLength(3);
    expect(ctx.dresses[0]).toEqual({
      id: "dfffa27b-6df8-4a31-a0ee-94a1a499143b",
      name: "שמלה כתומה",
      imageUrl: undefined,
    });
    expect(ctx.dresses[1]).toEqual({
      id: "d956e6d3-2757-4003-a2d3-9904b01d485c",
      name: "שמלה ורודה",
      imageUrl: "https://cdn.example.com/pink.jpg",
    });
  });

  it("returns user: null and dresses: [] when the lead is unknown", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: [] })
    );

    const ctx = await fetchLeadContext(URL, "rec_unknown");

    expect(ctx.user).toBeNull();
    expect(ctx.dresses).toEqual([]);
  });

  it("throws when the URL is empty", async () => {
    await expect(fetchLeadContext("", "rec_abc")).rejects.toThrow(/webhook/i);
  });

  it("throws when HTTP status is not OK", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/500/);
  });

  it("throws when items is not an array", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({ user: null, items: { foo: "bar" } })
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/items/i);
  });

  it("throws when the body is not valid JSON", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okText("not json")
    );

    await expect(fetchLeadContext(URL, "rec_abc")).rejects.toThrow(/json/i);
  });

  it("skips items missing id or data.name; keeps the rest", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      okJson({
        user: null,
        items: [
          { id: "good-1", data: { name: "שמלה טובה", picture: null } },
          { id: "bad-no-name", data: { picture: null } },
          { data: { name: "שמלה ללא מזהה", picture: null } },
          { id: "good-2", data: { name: "שמלה נוספת", picture: null } },
        ],
      })
    );

    const ctx = await fetchLeadContext(URL, "rec_abc");

    expect(ctx.dresses.map((d) => d.id)).toEqual(["good-1", "good-2"]);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/services/leadContextService.test.ts`
Expected: FAIL — `Cannot find module './leadContextService'`.

- [ ] **Step 3: Implement `leadContextService.ts`**

Create `src/services/leadContextService.ts`:

```ts
import type { Dress, LeadContext, LeadUser } from "@/types/domain";

export async function fetchLeadContext(
  webhookUrl: string,
  recordId: string
): Promise<LeadContext> {
  if (!webhookUrl) {
    throw new Error("Dresses webhook URL is not configured.");
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ record_id: recordId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to load dresses (status ${response.status}).`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error("Invalid JSON from server.");
  }

  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid response shape.");
  }

  const root = body as Record<string, unknown>;
  if (!Array.isArray(root.items)) {
    throw new Error("Invalid response shape: items is not an array.");
  }

  const dresses: Dress[] = [];
  for (const raw of root.items) {
    if (typeof raw !== "object" || raw === null) continue;
    const item = raw as Record<string, unknown>;
    const id = item.id;
    const data =
      typeof item.data === "object" && item.data !== null
        ? (item.data as Record<string, unknown>)
        : undefined;
    const name = data?.name;
    if (typeof id !== "string" || typeof name !== "string") continue;
    const picture = data?.picture;
    const imageUrl =
      typeof picture === "string" && picture.length > 0 ? picture : undefined;
    dresses.push({ id, name, imageUrl });
  }

  const user = (root.user ?? null) as LeadUser | null;
  return { user, dresses };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `npx vitest run src/services/leadContextService.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Run full typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

## Task 3: `LoadFailedScreen` component

**Files:**
- Create: `src/components/LoadFailedScreen.tsx`

This screen mirrors the look of `MissingRecordIdScreen.tsx` and `MissingWebhookScreen.tsx`. No test file — it's a static layout with one button; behavior is verified via `RequestPage.test.tsx` in Task 8.

- [ ] **Step 1: Create the component**

Create `src/components/LoadFailedScreen.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface LoadFailedScreenProps {
  onRetry: () => void;
}

export function LoadFailedScreen({ onRetry }: LoadFailedScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            טעינת השמלות נכשלה
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              לא הצלחנו לטעון את רשימת השמלות. אנא נסו שוב, ואם הבעיה נמשכת
              צרו קשר עם התמיכה.
            </AlertDescription>
          </Alert>
          <Button type="button" onClick={onRetry} className="w-full">
            <RefreshCw className="h-4 w-4" />
            נסו שוב
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS.

---

## Task 4: `LeadNotFoundScreen` component — TDD

**Files:**
- Create: `src/components/LeadNotFoundScreen.tsx`
- Test: `src/components/LeadNotFoundScreen.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/components/LeadNotFoundScreen.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadNotFoundScreen } from "./LeadNotFoundScreen";

describe("LeadNotFoundScreen", () => {
  it("renders the Hebrew headline and body text", () => {
    render(<LeadNotFoundScreen />);
    expect(screen.getByText(/ליד לא נמצא/)).toBeInTheDocument();
    expect(
      screen.getByText(/לא נמצאה רשומת לקוח עם המזהה שסופק/)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to confirm it fails**

Run: `npx vitest run src/components/LeadNotFoundScreen.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the component**

Create `src/components/LeadNotFoundScreen.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle } from "lucide-react";

export function LeadNotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-destructive">
            <AlertTriangle className="h-6 w-6" />
            ליד לא נמצא
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>
              לא נמצאה רשומת לקוח עם המזהה שסופק. אנא צרו קשר עם התמיכה.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Run test to confirm it passes**

Run: `npx vitest run src/components/LeadNotFoundScreen.test.tsx`
Expected: PASS, 1 test.

---

## Task 5: Refactor `DressCombobox` to a pure controlled component — TDD

**Files:**
- Create: `src/components/DressCombobox.test.tsx`
- Modify: `src/components/DressCombobox.tsx`

The combobox currently calls `dressesService.searchDresses(query)`. We make it accept a `dresses: Dress[]` prop and filter client-side.

- [ ] **Step 1: Write the failing test for the new prop API**

Create `src/components/DressCombobox.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DressCombobox } from "./DressCombobox";
import type { Dress } from "@/types/domain";

const dresses: Dress[] = [
  { id: "d1", name: "שמלה כתומה" },
  { id: "d2", name: "שמלה ורודה" },
  { id: "d3", name: "שמלה אדומה" },
];

describe("DressCombobox", () => {
  it("renders all dresses passed via prop when opened", async () => {
    const user = userEvent.setup();
    render(
      <DressCombobox
        value=""
        onChange={() => {}}
        dresses={dresses}
      />
    );
    await user.click(screen.getByRole("button"));
    expect(
      await screen.findByRole("option", { name: "שמלה כתומה" })
    ).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "שמלה ורודה" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "שמלה אדומה" })).toBeInTheDocument();
  });

  it("filters client-side by substring (case-insensitive)", async () => {
    const user = userEvent.setup();
    render(
      <DressCombobox
        value=""
        onChange={() => {}}
        dresses={dresses}
      />
    );
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByLabelText(/חיפוש שמלה/), "ור");
    expect(
      await screen.findByRole("option", { name: "שמלה ורודה" })
    ).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "שמלה כתומה" })).not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "שמלה אדומה" })).not.toBeInTheDocument();
  });

  it("calls onChange with the selected dress object", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DressCombobox
        value=""
        onChange={onChange}
        dresses={dresses}
      />
    );
    await user.click(screen.getByRole("button"));
    await user.click(await screen.findByRole("option", { name: "שמלה ורודה" }));
    expect(onChange).toHaveBeenCalledWith({ id: "d2", name: "שמלה ורודה" });
  });

  it("shows the empty state when nothing matches the query", async () => {
    const user = userEvent.setup();
    render(
      <DressCombobox
        value=""
        onChange={() => {}}
        dresses={dresses}
      />
    );
    await user.click(screen.getByRole("button"));
    await user.type(screen.getByLabelText(/חיפוש שמלה/), "xyz");
    expect(
      await screen.findByText(/לא נמצאו שמלות תואמות/)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx vitest run src/components/DressCombobox.test.tsx`
Expected: FAIL — type error / runtime error because `dresses` prop is not accepted.

- [ ] **Step 3: Rewrite `DressCombobox.tsx`**

Replace the contents of `src/components/DressCombobox.tsx` with:

```tsx
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dress } from "@/types/domain";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DressComboboxProps {
  id?: string;
  value: string;
  selectedName?: string;
  dresses: Dress[];
  onChange: (dress: Dress) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
}

export function DressCombobox({
  id,
  value,
  selectedName,
  dresses,
  onChange,
  placeholder = "בחרו שמלה...",
  "aria-invalid": ariaInvalid,
}: DressComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? dresses.filter((d) => d.name.toLowerCase().includes(trimmed))
    : dresses;

  const display = value ? selectedName ?? value : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={ariaInvalid}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-right text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="line-clamp-1">{value ? display : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפשו שמלה..."
              className="pr-8 h-9"
              aria-label="חיפוש שמלה"
            />
          </div>
        </div>
        <div
          className="max-h-64 overflow-auto p-1"
          role="listbox"
          data-testid="dress-combobox-list"
        >
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              לא נמצאו שמלות תואמות
            </div>
          ) : (
            results.map((dress) => {
              const selected = dress.id === value;
              return (
                <button
                  key={dress.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(dress);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-right text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    selected && "bg-accent/60"
                  )}
                >
                  <span className="line-clamp-1">{dress.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

What changed: dropped `dressesService`, `useDebouncedValue`, `loading`, `requestId`, the in-flight tracker, and the loading indicator JSX. Filtering happens synchronously against the prop.

- [ ] **Step 4: Run combobox tests**

Run: `npx vitest run src/components/DressCombobox.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 5: Confirm typecheck passes**

Run: `npm run typecheck`
Expected: FAIL — `DressRow.tsx` does not yet pass `dresses` to `DressCombobox`. Fixed in Task 6.

---

## Task 6: Forward `dresses` through `DressRow`

**Files:**
- Modify: `src/components/DressRow.tsx`

`DressRow` already receives `dresses: Dress[]`. We just thread it into the combobox.

- [ ] **Step 1: Add the prop on the `DressCombobox` instance**

In `src/components/DressRow.tsx`, find the `<DressCombobox ... />` usage (around line 153). Add a `dresses={dresses}` prop:

```tsx
<DressCombobox
  id={dressId}
  value={value.dressId}
  selectedName={
    dresses.find((d) => d.id === value.dressId)?.name
  }
  dresses={dresses}
  onChange={(dress) => onChange({ ...value, dressId: dress.id })}
  aria-invalid={Boolean(errorsByField.dress)}
/>
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run combobox + DressRow-related tests**

Run: `npx vitest run src/components/DressCombobox.test.tsx`
Expected: PASS.

(Note: `RequestPage.test.tsx` will still fail at this stage because the page hasn't been rewired yet. That's fine — Task 7 + 8 fix it.)

---

## Task 7: Wire `RequestPage` to `leadContextService`

**Files:**
- Modify: `src/pages/RequestPage.tsx`

This is the main wiring task. We do all the page changes here in one shot, but **don't run the page tests yet** — the tests need updating in Task 8.

- [ ] **Step 1: Replace `RequestPage.tsx` contents**

Replace `src/pages/RequestPage.tsx` with:

```tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DressRow } from "@/components/DressRow";
import { MissingRecordIdScreen } from "@/components/MissingRecordIdScreen";
import { MissingWebhookScreen } from "@/components/MissingWebhookScreen";
import { LoadFailedScreen } from "@/components/LoadFailedScreen";
import { LeadNotFoundScreen } from "@/components/LeadNotFoundScreen";

import { fetchLeadContext } from "@/services/leadContextService";
import { orderLinesService } from "@/services/orderLinesService";
import { validateSubmission } from "@/lib/validation";
import { buildWebhookPayload, submitToWebhook } from "@/lib/webhook";
import type {
  Dress,
  DressSelection,
  LeadUser,
  OrderLine,
  ValidationError,
} from "@/types/domain";

const emptySelection = (): DressSelection => ({
  dressId: "",
  startDate: "",
  endDate: "",
});

export function RequestPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const recordId = (searchParams.get("record_id") ?? "").trim();

  const submitWebhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL as
    | string
    | undefined;
  const dressesWebhookUrl = import.meta.env.VITE_MAKE_DRESSES_WEBHOOK_URL as
    | string
    | undefined;

  const [user, setUser] = useState<LeadUser | null>(null);
  const [dresses, setDresses] = useState<Dress[]>([]);
  const [orderLines, setOrderLines] = useState<OrderLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [selections, setSelections] = useState<DressSelection[]>([
    emptySelection(),
  ]);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!recordId || !submitWebhookUrl || !dressesWebhookUrl) {
      setLoading(false);
      return;
    }
    let mounted = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      fetchLeadContext(dressesWebhookUrl, recordId),
      orderLinesService.listAllOrderLines(),
    ])
      .then(([ctx, ol]) => {
        if (!mounted) return;
        setUser(ctx.user);
        setDresses(ctx.dresses);
        setOrderLines(ol);
      })
      .catch((err) => {
        if (!mounted) return;
        console.error("Failed to load lead context", err);
        setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [recordId, submitWebhookUrl, dressesWebhookUrl, loadKey]);

  const errorsByIndex = useMemo(() => {
    const map = new Map<number, ValidationError[]>();
    for (const err of errors) {
      if (typeof err.index === "number") {
        const list = map.get(err.index) ?? [];
        list.push(err);
        map.set(err.index, list);
      }
    }
    return map;
  }, [errors]);

  const formLevelErrors = errors.filter((e) => typeof e.index !== "number");

  if (!recordId) {
    return <MissingRecordIdScreen />;
  }

  if (!submitWebhookUrl || !dressesWebhookUrl) {
    return <MissingWebhookScreen />;
  }

  if (loadError) {
    return <LoadFailedScreen onRetry={() => setLoadKey((k) => k + 1)} />;
  }

  if (!loading && user === null) {
    return <LeadNotFoundScreen />;
  }

  const updateRow = (index: number, next: DressSelection) => {
    setSelections((prev) =>
      prev.map((row, i) => (i === index ? next : row))
    );
  };

  const removeRow = (index: number) => {
    setSelections((prev) => prev.filter((_, i) => i !== index));
  };

  const addRow = () => {
    setSelections((prev) => [...prev, emptySelection()]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = validateSubmission(
      { recordId, selections },
      orderLines
    );

    setErrors(result.errors);
    if (!result.ok) {
      toast.error("לא ניתן לשלוח את הבקשה. אנא בדקו את השדות המסומנים.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildWebhookPayload({
        recordId,
        selections,
        dresses,
        now: new Date(),
      });
      await submitToWebhook(submitWebhookUrl, payload);
      navigate("/thank-you", {
        state: { summary: payload },
        replace: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "שגיאה לא ידועה.";
      toast.error(`שליחת הבקשה נכשלה: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 py-8">
      <div className="container max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle>בקשת השכרת שמלות</CardTitle>
            <CardDescription>
              אנא בחרו את השמלות הרצויות וציינו את תאריכי ההשכרה. לאחר השליחה,
              ניצור איתכם קשר לאישור.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                טוען שמלות זמינות...
              </p>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {formLevelErrors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <ul className="space-y-1">
                        {formLevelErrors.map((e) => (
                          <li key={e.code}>{e.message}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  {selections.map((row, index) => (
                    <DressRow
                      key={index}
                      index={index}
                      value={row}
                      dresses={dresses}
                      orderLines={orderLines}
                      errors={errorsByIndex.get(index) ?? []}
                      canRemove={selections.length > 1}
                      onChange={(next) => updateRow(index, next)}
                      onRemove={() => removeRow(index)}
                    />
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addRow}
                  >
                    <Plus className="h-4 w-4" />
                    הוספת שמלה נוספת
                  </Button>

                  <Button type="submit" disabled={submitting}>
                    <Send className="h-4 w-4" />
                    {submitting ? "שולח..." : "שליחת הבקשה"}
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

What changed vs the old file:
- Removed `dressesService` import; added `fetchLeadContext`, `LoadFailedScreen`, `LeadNotFoundScreen`.
- Added `dressesWebhookUrl` env read; both URL env vars are now required.
- Added `user`, `loadError`, `loadKey` state.
- Effect now calls `fetchLeadContext` (instead of `dressesService.listDresses`) and handles rejections by setting `loadError = true`.
- Effect re-runs when `loadKey` changes (used by `LoadFailedScreen`'s retry).
- Three new render branches: `LoadFailedScreen` (on error), `LeadNotFoundScreen` (on `user === null` after a successful load), and the existing form for the happy path.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Run unit-test files that don't depend on RequestPage**

Run: `npx vitest run src/services/leadContextService.test.ts src/components/LeadNotFoundScreen.test.tsx src/components/DressCombobox.test.tsx`
Expected: PASS for all three suites. (`RequestPage.test.tsx` is intentionally not run yet — Task 8 fixes it.)

---

## Task 8: Update `RequestPage.test.tsx`

**Files:**
- Modify: `src/pages/RequestPage.test.tsx`

The page now fetches dresses over the network. We must (a) stub the new env var, (b) make `globalThis.fetch` URL-aware so it returns canned dress data for the dresses URL and 200 OK for the submit URL, and (c) add new tests for the load-error, retry, and lead-not-found branches.

- [ ] **Step 1: Replace the whole top-of-file block (imports, constants, top-level mocks)**

Replace everything in `src/pages/RequestPage.test.tsx` from line 1 through and including the closing `});` of the first `beforeEach(...)` block (in the original file, the `beforeEach` that calls `vi.useFakeTimers`, `vi.stubEnv`, and assigns `globalThis.fetch`). The original `afterEach` that follows it stays untouched.

The new top of the file:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { RequestPage } from "./RequestPage";
import { ThankYouPage } from "./ThankYouPage";
import { expectDateDisabled, pickDate } from "@/test/datePickerHelpers";
import { pickFromSelect } from "@/test/selectHelpers";

const SUBMIT_URL = "https://hook.example.com/submit";
const DRESSES_URL = "https://hook.example.com/dresses";

const DRESS_NAMES = {
  "dress-001": "שמלת ערב כחולה",
  "dress-002": "שמלת חתונה לבנה קלאסית",
  "dress-005": "שמלת חתונה בוהו",
} as const;

const DEFAULT_LEAD_CONTEXT = {
  user: {
    id: "rec_123",
    entity_id: "ent",
    tenant_id: "ten",
    display_name: "Test User",
    data: {},
    computed: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  items: [
    { id: "dress-001", data: { name: DRESS_NAMES["dress-001"], picture: null } },
    { id: "dress-002", data: { name: DRESS_NAMES["dress-002"], picture: null } },
    { id: "dress-005", data: { name: DRESS_NAMES["dress-005"], picture: null } },
  ],
};

interface FetchOverrides {
  dresses?: () => Response | Promise<Response>;
  submit?: () => Response | Promise<Response>;
}

function installFetchMock(overrides: FetchOverrides = {}) {
  const dressesHandler =
    overrides.dresses ??
    (() =>
      ({
        ok: true,
        status: 200,
        json: async () => DEFAULT_LEAD_CONTEXT,
      }) as unknown as Response);
  const submitHandler =
    overrides.submit ?? (() => ({ ok: true, status: 200 } as Response));

  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url === DRESSES_URL) return dressesHandler();
    if (url === SUBMIT_URL) return submitHandler();
    throw new Error(`Unexpected fetch URL in test: ${url}`);
  }) as typeof globalThis.fetch;
}

const renderApp = (initialUrl: string) =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/" element={<RequestPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("RequestPage", () => {
  const originalFetch = globalThis.fetch;
  const FIXED_NOW = new Date(2026, 4, 1, 12, 0, 0); // 1 May 2026 local

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW, shouldAdvanceTime: true });
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", SUBMIT_URL);
    vi.stubEnv("VITE_MAKE_DRESSES_WEBHOOK_URL", DRESSES_URL);
    installFetchMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });
```

- [ ] **Step 2: Update the existing submit-flow assertions to filter by URL**

Several existing tests do:

```ts
expect(globalThis.fetch).toHaveBeenCalledTimes(1);
const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
expect(url).toBe("https://hook.example.com/test");
```

These now need to look at the **submit** call specifically — the dresses fetch happens at mount, so `fetch` will have been called more than once. Replace each such block with:

```ts
await waitFor(() => {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  expect(calls.some(([u]) => u === SUBMIT_URL)).toBe(true);
});
const submitCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
  ([u]) => u === SUBMIT_URL
)!;
const [url, init] = submitCall;
expect(url).toBe(SUBMIT_URL);
```

Apply this transformation in every test that asserts `expect(globalThis.fetch).toHaveBeenCalledTimes(1)` followed by reading `mock.calls[0]`. In the current file that's:
- `it("submits successfully for a single available dress and redirects", ...)`
- `it("submits successfully when multiple available dresses are selected", ...)`
- `it("allows the same dates for a different dress that is not booked then", ...)`

For the simpler `expect(globalThis.fetch).not.toHaveBeenCalled()` assertions in the "blocks submission" tests — those need to assert "submit was not called" rather than "fetch was not called", because the dresses fetch already happened. Replace:

```ts
expect(globalThis.fetch).not.toHaveBeenCalled();
```

with:

```ts
const submitCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
  ([u]) => u === SUBMIT_URL
);
expect(submitCalls).toHaveLength(0);
```

Apply this in:
- `it("blocks submission when no dress is selected", ...)`
- `it("blocks submission when start or end date is missing", ...)`

- [ ] **Step 3: Add three new tests inside the main `describe("RequestPage")`**

After the existing happy-path tests (anywhere before the closing `});` of the main describe), add:

```tsx
  it("renders LoadFailedScreen when the dresses fetch rejects", async () => {
    installFetchMock({
      dresses: () =>
        ({ ok: false, status: 500 } as Response),
    });
    renderApp("/?record_id=rec_123");
    expect(
      await screen.findByText(/טעינת השמלות נכשלה/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /נסו שוב/ })
    ).toBeInTheDocument();
  });

  it("retries the fetch when the user clicks נסו שוב", async () => {
    let callCount = 0;
    installFetchMock({
      dresses: () => {
        callCount += 1;
        if (callCount === 1) {
          return { ok: false, status: 500 } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => DEFAULT_LEAD_CONTEXT,
        } as unknown as Response;
      },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByText(/טעינת השמלות נכשלה/);
    await user.click(screen.getByRole("button", { name: /נסו שוב/ }));

    expect(
      await screen.findByRole("heading", { name: /בקשת השכרת שמלות/i })
    ).toBeInTheDocument();
    expect(callCount).toBe(2);
  });

  it("renders LeadNotFoundScreen when the webhook returns user: null", async () => {
    installFetchMock({
      dresses: () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ user: null, items: [] }),
        }) as unknown as Response,
    });
    renderApp("/?record_id=rec_unknown");
    expect(
      await screen.findByText(/ליד לא נמצא/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /בקשת השכרת שמלות/i })
    ).not.toBeInTheDocument();
  });
```

- [ ] **Step 4: Update the bottom `describe("RequestPage missing webhook configuration")` block**

Replace the existing block:

```tsx
describe("RequestPage missing webhook configuration", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the configuration error screen when no webhook url is set", () => {
    renderApp("/?record_id=rec_123");
    expect(
      screen.getByText(/כתובת ה־webhook אינה מוגדרת/)
    ).toBeInTheDocument();
  });
});
```

with:

```tsx
describe("RequestPage missing webhook configuration", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the configuration error screen when the submit webhook url is missing", () => {
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", "");
    vi.stubEnv("VITE_MAKE_DRESSES_WEBHOOK_URL", DRESSES_URL);
    renderApp("/?record_id=rec_123");
    expect(
      screen.getByText(/כתובת ה־webhook אינה מוגדרת/)
    ).toBeInTheDocument();
  });

  it("shows the configuration error screen when the dresses webhook url is missing", () => {
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", SUBMIT_URL);
    vi.stubEnv("VITE_MAKE_DRESSES_WEBHOOK_URL", "");
    renderApp("/?record_id=rec_123");
    expect(
      screen.getByText(/כתובת ה־webhook אינה מוגדרת/)
    ).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run the page tests**

Run: `npx vitest run src/pages/RequestPage.test.tsx`
Expected: PASS, all tests (the original happy-path tests + 3 new ones + 2 missing-config tests).

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: PASS, no failures across the whole suite.

---

## Task 9: Delete `dressesService.ts` and `MOCK_DRESSES`

**Files:**
- Delete: `src/services/dressesService.ts`
- Modify: `src/services/mockData.ts`

- [ ] **Step 1: Delete the service file**

Run: `rm src/services/dressesService.ts`

- [ ] **Step 2: Remove `MOCK_DRESSES` from `mockData.ts`**

Edit `src/services/mockData.ts`:
- Remove the `Dress` import.
- Remove the entire `export const MOCK_DRESSES` block.
- Keep `import type { OrderLine } from "@/types/domain";` and the `MOCK_ORDER_LINES` export.

The resulting file should be:

```ts
import type { OrderLine } from "@/types/domain";

export const MOCK_ORDER_LINES: OrderLine[] = [
  { id: "ol-1", dressId: "dress-001", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol-2", dressId: "dress-001", startDate: "2026-07-15", endDate: "2026-07-20" },
  { id: "ol-3", dressId: "dress-002", startDate: "2026-06-10", endDate: "2026-06-14" },
  { id: "ol-4", dressId: "dress-003", startDate: "2026-08-01", endDate: "2026-08-03" },
  { id: "ol-5", dressId: "dress-004", startDate: "2026-09-12", endDate: "2026-09-16" },
];
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS. (Nothing should still import `dressesService` or `MOCK_DRESSES` — Tasks 5 and 7 already removed those imports.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS.

---

## Task 10: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the env var section**

Find this block in `README.md` (around line 40-45):

```bash
npm install
cp .env.example .env.local
# fill in VITE_MAKE_WEBHOOK_URL in .env.local
npm run dev
```

Replace the comment line with:

```bash
npm install
cp .env.example .env.local
# fill in VITE_MAKE_WEBHOOK_URL (submit) and VITE_MAKE_DRESSES_WEBHOOK_URL (load) in .env.local
npm run dev
```

And add a note below the dev command explaining the two URLs:

```
The site requires two Make.com webhook URLs:
- VITE_MAKE_WEBHOOK_URL — receives new rental requests on submit.
- VITE_MAKE_DRESSES_WEBHOOK_URL — called on page load with `{ record_id }`,
  returns `{ user, items }` (lead + active dresses) for that customer.
```

- [ ] **Step 2: Update the missing-config behavior note**

Find the line:

```
If `VITE_MAKE_WEBHOOK_URL` is missing, a Hebrew configuration error screen is
shown instead of the form.
```

Replace with:

```
If either `VITE_MAKE_WEBHOOK_URL` or `VITE_MAKE_DRESSES_WEBHOOK_URL` is
missing, a Hebrew configuration error screen is shown instead of the form.
```

- [ ] **Step 3: Update the architecture section**

In the `src/services/` listing inside the architecture tree (around line 70-77), replace:

```
  services/
    dressesService.ts       # interface + mock impl (listDresses)
    orderLinesService.ts    # interface + mock impl (listAllOrderLines, byDress)
    mockData.ts             # hard-coded dresses + reservations for development
```

with:

```
  services/
    leadContextService.ts   # POSTs record_id to Make.com, returns { user, dresses }
    orderLinesService.ts    # interface + mock impl (listAllOrderLines, byDress)
    mockData.ts             # hard-coded reservations for development
```

In the `components/` listing, add `LoadFailedScreen.tsx` and `LeadNotFoundScreen.tsx` next to the existing `Missing*Screen.tsx` entries.

- [ ] **Step 4: Update the integration-model table**

Find the table:

```
| Direction | How | What |
|---|---|---|
| Read | Site → EasyFlow API (direct, **read-only** token) | Dress catalog + existing reservations to compute availability |
| Write | Site → Make.com webhook → EasyFlow | New rental request; Make.com creates the order rows |
| EasyFlow itself | Untouched | No schema changes, no code changes inside EasyFlow |
```

Replace the "Read" row with:

```
| Read | Site → Make.com webhook → EasyFlow | Lead + active dresses for the customer (keyed by `record_id`) |
```

(The site no longer holds an EasyFlow API token — all reads go through Make.com.) Then update the paragraph below the table that says "The site holds a read-only EasyFlow API token..." to:

```
The site never talks to EasyFlow directly. All reads go through the dresses
webhook (load-time fetch keyed by `record_id`); all writes go through the
submit webhook. EasyFlow itself is untouched.
```

- [ ] **Step 5: Update the manual test checklist**

Replace the existing checklist (the bullet list at the bottom of the README) with:

```
## Manual test checklist

- Open `/` (no record_id) → Hebrew "missing record_id" screen.
- Open `/?record_id=` (empty) → same screen.
- Open `/?record_id=7bfde42c-5d00-49bd-9de3-9094e5d0f0ea` → form renders with the live CRM dresses (e.g., כתומה / ורודה / אדומה).
- Open the dress combobox → all dresses visible. Type "ור" → only "שמלה ורודה" remains.
- Open with an unknown record_id (e.g., `00000000-0000-0000-0000-000000000000`) → `LeadNotFoundScreen` ("ליד לא נמצא") renders, form does not appear.
- Temporarily point `VITE_MAKE_DRESSES_WEBHOOK_URL` at a non-existent host or a 500 endpoint → reload → `LoadFailedScreen`. Restore env, click "נסו שוב" → page recovers.
- Remove `VITE_MAKE_DRESSES_WEBHOOK_URL` from `.env.local` → reload → "תצורה חסרה" screen.
- Remove `VITE_MAKE_WEBHOOK_URL` from `.env.local` → reload → "תצורה חסרה" screen.
- Pick a dress, set start + end → submit → thank-you page with summary.
- Click "הוספת שמלה נוספת" twice → three rows. Remove the middle one.
- Pick the same dress twice → duplicate error.
- Pick start > end → "תאריך הסיום מוקדם מתאריך ההתחלה".
- Pick `dress-001` mock data IDs are no longer applicable in production; conflict checks now use whatever dresses Make.com returns.
```

(Drop the now-irrelevant `dress-001`/`dress-005` mock-specific lines from the original checklist.)

- [ ] **Step 6: Verify the README still renders**

Run: `npx markdown-it README.md > /dev/null` if available, otherwise just open it visually.
Expected: no obvious syntax errors.

---

## Task 11: Final validation

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 2: Full test suite**

Run: `npm test`
Expected: PASS — all suites green.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS (type-checked Vite production build succeeds).

- [ ] **Step 4: Lint**

Run: `npm run lint`
Expected: PASS, or only pre-existing warnings (no new errors introduced by this work).

- [ ] **Step 5: Manual smoke against the real webhook**

Set in `.env.local`:

```
VITE_MAKE_WEBHOOK_URL=<your existing submit webhook>
VITE_MAKE_DRESSES_WEBHOOK_URL=https://hook.eu1.make.com/ckfk7tujrdsu1c753mqe3cdlfb8xb1br
```

Run: `npm run dev`

Open: `http://localhost:5173/?record_id=7bfde42c-5d00-49bd-9de3-9094e5d0f0ea`

Verify:
- Form renders.
- Dress combobox lists the 3 real CRM dresses (כתומה / ורודה / אדומה).
- Typing in the search filters them.
- Open with `record_id=00000000-0000-0000-0000-000000000000` → "ליד לא נמצא" appears (assuming Make.com returns `user: null` for unknown leads — if it 500s instead, you'll see the load-failed screen, which is also acceptable).

- [ ] **Step 6: Hand off to user**

The user will commit the work themselves. Report:
- Tasks completed.
- Test counts (suites + total).
- Anything unexpected from the manual smoke.
