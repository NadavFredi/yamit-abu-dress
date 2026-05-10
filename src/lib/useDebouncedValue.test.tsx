import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useDebouncedValue } from "./useDebouncedValue";

function Probe({ value, delayMs }: { value: string; delayMs: number }) {
  const debounced = useDebouncedValue(value, delayMs);
  return <div data-testid="value">{debounced}</div>;
}

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    vi.useFakeTimers();
    render(<Probe value="first" delayMs={300} />);

    expect(screen.getByTestId("value")).toHaveTextContent("first");
  });

  it("updates only after the configured delay", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe value="first" delayMs={300} />);

    rerender(<Probe value="second" delayMs={300} />);
    expect(screen.getByTestId("value")).toHaveTextContent("first");

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(screen.getByTestId("value")).toHaveTextContent("first");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId("value")).toHaveTextContent("second");
  });

  it("cancels stale pending updates when the value changes again", () => {
    vi.useFakeTimers();
    const { rerender } = render(<Probe value="first" delayMs={300} />);

    rerender(<Probe value="second" delayMs={300} />);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender(<Probe value="third" delayMs={300} />);

    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByTestId("value")).toHaveTextContent("first");

    act(() => {
      vi.advanceTimersByTime(151);
    });
    expect(screen.getByTestId("value")).toHaveTextContent("third");
  });
});
