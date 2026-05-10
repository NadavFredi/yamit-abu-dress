import { screen } from "@testing-library/react";
import type userEvent from "@testing-library/user-event";

type User = ReturnType<typeof userEvent.setup>;

export async function pickFromSelect(
  user: User,
  trigger: HTMLElement,
  optionName: string | RegExp
): Promise<void> {
  await user.click(trigger);
  const option = await screen.findByRole("option", { name: optionName });
  await user.click(option);
}
