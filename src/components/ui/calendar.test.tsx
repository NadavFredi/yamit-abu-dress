import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar } from "./calendar";
import type { DateState } from "@/lib/datePickerRules";

// Use a fixed "today" so tests don't drift: 2026-05-01
const FIXED_NOW = new Date(2026, 4, 1); // May 1 2026

afterEach(() => {
  vi.useRealTimers();
});

function renderCalendar(props: Partial<React.ComponentProps<typeof Calendar>> = {}) {
  return render(
    <Calendar month={new Date(2026, 4, 1)} {...props} />
  );
}

describe("Calendar – days view rendering", () => {
  it("renders a button with aria-label set to the iso string for each day in May 2026", () => {
    renderCalendar();
    // May 2026 has 31 days; each gets aria-label "2026-05-DD"
    const dayBtn = screen.getByRole("button", { name: "2026-05-01" });
    expect(dayBtn).toBeInTheDocument();
    const lastDay = screen.getByRole("button", { name: "2026-05-31" });
    expect(lastDay).toBeInTheDocument();
  });

  it("clicking an enabled day calls onSelect with the corresponding Date", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCalendar({ onSelect });

    const dayBtn = screen.getByRole("button", { name: "2026-05-15" });
    await user.click(dayBtn);

    expect(onSelect).toHaveBeenCalledOnce();
    const received: Date = onSelect.mock.calls[0][0];
    expect(received.getFullYear()).toBe(2026);
    expect(received.getMonth()).toBe(4); // May = 4
    expect(received.getDate()).toBe(15);
  });
});

describe("Calendar – booked day", () => {
  const bookedDateState = (iso: string): DateState =>
    iso === "2026-05-10" ? "booked" : null;

  it("a booked day has data-disabled='true'", () => {
    renderCalendar({ dateState: bookedDateState });
    const btn = screen.getByRole("button", { name: "2026-05-10" });
    expect(btn).toHaveAttribute("data-disabled", "true");
  });

  it("a booked day has data-disabled-kind='booked'", () => {
    renderCalendar({ dateState: bookedDateState });
    const btn = screen.getByRole("button", { name: "2026-05-10" });
    expect(btn).toHaveAttribute("data-disabled-kind", "booked");
  });

  it("a booked day has the native disabled attribute", () => {
    renderCalendar({ dateState: bookedDateState });
    const btn = screen.getByRole("button", { name: "2026-05-10" });
    expect(btn).toBeDisabled();
  });

  it("clicking a booked day does NOT call onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCalendar({ dateState: bookedDateState, onSelect });

    const btn = screen.getByRole("button", { name: "2026-05-10" });
    await user.click(btn);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Calendar – past day", () => {
  const pastDateState = (iso: string): DateState =>
    iso === "2026-05-05" ? "past" : null;

  it("a past day has data-disabled-kind='past'", () => {
    renderCalendar({ dateState: pastDateState });
    const btn = screen.getByRole("button", { name: "2026-05-05" });
    expect(btn).toHaveAttribute("data-disabled-kind", "past");
  });

  it("clicking a past day does NOT call onSelect", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    renderCalendar({ dateState: pastDateState, onSelect });

    const btn = screen.getByRole("button", { name: "2026-05-05" });
    await user.click(btn);

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Calendar – legend prop", () => {
  it("legend is rendered below the day grid in days view", () => {
    renderCalendar({ legend: <span data-testid="my-legend">Legend text</span> });
    expect(screen.getByTestId("my-legend")).toBeInTheDocument();
  });

  it("legend is NOT rendered in months view (after clicking the month/year label)", async () => {
    const user = userEvent.setup();
    renderCalendar({ legend: <span data-testid="my-legend">Legend text</span> });

    // The label button shows the month/year text. Clicking it toggles to months view.
    const calendar = screen.getByTestId("calendar");
    // Find the label button — it's the button that is NOT prev/next nav
    const allButtons = within(calendar).getAllByRole("button");
    const labelBtn = allButtons.find(
      (b) => !b.getAttribute("aria-label")?.includes("חודש")
    );
    expect(labelBtn).toBeDefined();
    await user.click(labelBtn!);

    expect(screen.queryByTestId("my-legend")).not.toBeInTheDocument();
  });
});

describe("Calendar – every visible day disabled (extreme)", () => {
  it("renders without crashing when dateState marks all days disabled", () => {
    const allDisabled = (): DateState => "booked";
    renderCalendar({ dateState: allDisabled });
    const calendar = screen.getByTestId("calendar");
    const dayButtons = within(calendar)
      .getAllByRole("button")
      .filter((b) => /^\d{4}-\d{2}-\d{2}$/.test(b.getAttribute("aria-label") ?? ""));
    expect(dayButtons.length).toBeGreaterThan(0);
    dayButtons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});

describe("Calendar – today border still applies when today is disabled", () => {
  it("the today day button still receives the today border class when it is booked", () => {
    vi.useFakeTimers({ now: FIXED_NOW });
    const bookedToday = (iso: string): DateState =>
      iso === "2026-05-01" ? "booked" : null;
    renderCalendar({ dateState: bookedToday });

    const todayBtn = screen.getByRole("button", { name: "2026-05-01" });
    // The component always adds the border class for today regardless of disabled state.
    expect(todayBtn).toHaveAttribute("data-disabled", "true");
    // The border is applied via className — we verify the class list contains border
    expect(todayBtn.className).toMatch(/border/);
  });
});
