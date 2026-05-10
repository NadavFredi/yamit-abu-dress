import { screen, waitFor, within } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

export async function pickDate(
  user: User,
  trigger: HTMLElement,
  iso: string
): Promise<void> {
  await user.click(trigger);

  const calendar = await screen.findByTestId("calendar");

  const targetMonth = iso.slice(0, 7);

  const stepToTarget = async () => {
    let safety = 60;
    while (safety > 0) {
      const current = calendar.getAttribute("data-current-month");
      if (current === targetMonth) return;
      const direction = (current ?? "") < targetMonth ? "next" : "prev";
      const button = within(calendar).getByRole("button", {
        name: direction === "next" ? /חודש הבא/ : /חודש קודם/,
      });
      await user.click(button);
      safety -= 1;
    }
  };

  await stepToTarget();

  await waitFor(() => {
    expect(calendar.getAttribute("data-current-month")).toBe(targetMonth);
  });

  const dayButton = within(calendar).getByRole("button", { name: iso });
  await user.click(dayButton);
}

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
