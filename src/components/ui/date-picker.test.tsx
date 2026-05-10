import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DatePicker } from "./date-picker";
import type { DateState } from "@/lib/datePickerRules";

function renderPicker(props: Partial<React.ComponentProps<typeof DatePicker>> = {}) {
  return render(
    <DatePicker value="" onChange={vi.fn()} {...props} />
  );
}

describe("DatePicker – display", () => {
  it("shows the placeholder when value is empty", () => {
    renderPicker({ placeholder: "בחרו תאריך" });
    expect(screen.getByText("בחרו תאריך")).toBeInTheDocument();
  });

  it("shows the value formatted as dd/mm/yyyy", () => {
    renderPicker({ value: "2026-06-10" });
    expect(screen.getByText("10/06/2026")).toBeInTheDocument();
  });
});

describe("DatePicker – disabled state", () => {
  it("the trigger button has the native disabled attribute when disabled=true", () => {
    renderPicker({ disabled: true });
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
  });

  it("clicking the trigger does not open the calendar when disabled", async () => {
    const user = userEvent.setup();
    renderPicker({ disabled: true });

    const trigger = screen.getByRole("button");
    await user.click(trigger);

    expect(screen.queryByTestId("calendar")).not.toBeInTheDocument();
  });
});

describe("DatePicker – selecting a date", () => {
  it("calls onChange with the ISO string when the user picks a date", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderPicker({ value: "", onChange, placeholder: "בחרו תאריך" });

    // Open the popover
    await user.click(screen.getByRole("button"));

    // The calendar opens; navigate to May 2026 if needed (default month is current real date).
    // Because the calendar uses `new Date()` internally when no `month` prop and no `selected`,
    // we rely on the fact that it renders a calendar. We'll click a specific day that is visible.
    // Find any day button with an iso aria-label and click it.
    const calendar = await screen.findByTestId("calendar");
    // Navigate until a specific day button is present
    let dayBtn = calendar.querySelector("[aria-label='2026-05-20']") as HTMLButtonElement | null;
    let attempts = 0;
    while (!dayBtn && attempts < 24) {
      const nextBtn = calendar.querySelector("[aria-label='חודש הבא']") as HTMLButtonElement;
      if (nextBtn) await user.click(nextBtn);
      const prevBtn = calendar.querySelector("[aria-label='חודש קודם']") as HTMLButtonElement;
      if (!nextBtn && prevBtn) await user.click(prevBtn);
      dayBtn = calendar.querySelector("[aria-label='2026-05-20']") as HTMLButtonElement | null;
      attempts++;
    }
    if (!dayBtn) {
      // Navigate to find 2026-05-20 using the previous month button
      const prevBtn = calendar.querySelector("[aria-label='חודש קודם']") as HTMLButtonElement;
      while (!dayBtn && attempts < 50) {
        await user.click(prevBtn);
        dayBtn = calendar.querySelector("[aria-label='2026-05-20']") as HTMLButtonElement | null;
        attempts++;
      }
    }
    expect(dayBtn).not.toBeNull();
    await user.click(dayBtn!);

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith("2026-05-20");
  });
});

describe("DatePicker – prop forwarding to Calendar", () => {
  it("dateState is forwarded: a day the dateState marks as booked is disabled in the calendar", async () => {
    const user = userEvent.setup();
    // Mark 2026-05-15 as booked
    const dateState = (iso: string): DateState =>
      iso === "2026-05-15" ? "booked" : null;

    renderPicker({
      value: "2026-05-01",
      onChange: vi.fn(),
      dateState,
    });

    // Open popover
    await user.click(screen.getByRole("button"));

    const calendar = await screen.findByTestId("calendar");

    // Navigate to May 2026 if not already there
    let attempts = 0;
    while (
      calendar.getAttribute("data-current-month") !== "2026-05" &&
      attempts < 24
    ) {
      const current = calendar.getAttribute("data-current-month") ?? "";
      const btn = calendar.querySelector(
        `[aria-label="${current < "2026-05" ? "חודש הבא" : "חודש קודם"}"]`
      ) as HTMLButtonElement;
      if (btn) await user.click(btn);
      attempts++;
    }

    const bookedBtn = calendar.querySelector("[aria-label='2026-05-15']");
    expect(bookedBtn).not.toBeNull();
    expect(bookedBtn).toHaveAttribute("data-disabled", "true");
  });

  it("legend is forwarded to the calendar and rendered", async () => {
    const user = userEvent.setup();
    renderPicker({
      value: "2026-05-01",
      onChange: vi.fn(),
      legend: <span data-testid="picker-legend">legend here</span>,
    });

    await user.click(screen.getByRole("button"));

    await screen.findByTestId("calendar");
    expect(screen.getByTestId("picker-legend")).toBeInTheDocument();
  });
});
