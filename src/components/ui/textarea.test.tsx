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
