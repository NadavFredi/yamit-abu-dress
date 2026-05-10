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
