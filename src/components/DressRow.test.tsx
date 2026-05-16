import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DressRow } from "./DressRow";
import { pickDate } from "@/test/datePickerHelpers";
import { pickFromSelect } from "@/test/selectHelpers";
import type {
  Dress,
  DressSelection,
  OrderLine,
  ValidationError,
} from "@/types/domain";

const dresses: Dress[] = [
  { id: "dress-1", name: "שמלה אדומה", inventory: null },
  { id: "dress-2", name: "שמלה כחולה", inventory: null },
];

const orderLines: OrderLine[] = [
  {
    id: "order-1",
    dressId: "dress-1",
    startDate: "2026-06-10",
    endDate: "2026-06-14",
    quantity: 1,
  },
];

function renderRow(
  overrides: Partial<React.ComponentProps<typeof DressRow>> = {}
) {
  const props: React.ComponentProps<typeof DressRow> = {
    index: 0,
    value: { dressId: "", startDate: "", endDate: "", quantity: 1 },
    dresses,
    orderLines,
    isReservationsLoading: false,
    errors: [],
    canRemove: false,
    onChange: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };

  render(<DressRow {...props} />);
  return props;
}

describe("DressRow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts with disabled date pickers and a pick-dress hint", () => {
    renderRow();

    expect(screen.getByText("שמלה 1")).toBeInTheDocument();
    expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
    expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();
    expect(screen.getByTestId("pick-dress-hint-0")).toHaveTextContent(
      /בחרו שמלה תחילה/
    );
    expect(
      screen.queryByRole("button", { name: /הסר שמלה/ })
    ).not.toBeInTheDocument();
  });

  it("shows a remove button only when canRemove is true and calls onRemove", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    renderRow({ index: 2, canRemove: true, onRemove });

    await user.click(screen.getByRole("button", { name: /הסר שמלה 3/ }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("calls onChange with the selected dress id when a dress is picked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderRow({ onChange });

    await pickFromSelect(user, screen.getByLabelText(/^שמלה$/), "שמלה כחולה");

    expect(onChange).toHaveBeenCalledWith({
      dressId: "dress-2",
      startDate: "",
      endDate: "",
      quantity: 1,
    });
  });

  it("disables date pickers and shows a loading hint while reservations load", () => {
    renderRow({
      value: { dressId: "dress-1", startDate: "", endDate: "", quantity: 1 },
      isReservationsLoading: true,
    });

    expect(screen.getByTestId("reservations-loading-0")).toHaveTextContent(
      /טוען זמינות/
    );
    expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
    expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();
    expect(screen.queryByText("תפוס")).not.toBeInTheDocument();
  });

  it("enables date pickers and shows the calendar legend when reservations are ready", async () => {
    const user = userEvent.setup();
    renderRow({
      value: { dressId: "dress-1", startDate: "", endDate: "", quantity: 1 },
    });

    expect(screen.getByLabelText(/תאריך התחלה/)).not.toBeDisabled();
    await user.click(screen.getByLabelText(/תאריך התחלה/));

    expect(await screen.findByText("תפוס")).toBeInTheDocument();
    expect(screen.getByText("תאריך עבר")).toBeInTheDocument();
  });

  it("calls onChange when a start date is selected", async () => {
    vi.useFakeTimers({
      now: new Date(2026, 4, 10, 12, 0, 0),
      shouldAdvanceTime: true,
    });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onChange = vi.fn();
    const value: DressSelection = {
      dressId: "dress-1",
      startDate: "",
      endDate: "",
      quantity: 1,
    };
    renderRow({ value, onChange });

    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-06-20");

    expect(onChange).toHaveBeenCalledWith({
      ...value,
      startDate: "2026-06-20",
    });
  });

  it("shows an available status when the selected range has no conflicts", () => {
    renderRow({
      value: {
        dressId: "dress-1",
        startDate: "2026-06-20",
        endDate: "2026-06-22",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-0")).toHaveAttribute(
      "data-status",
      "available"
    );
    expect(screen.getByText(/השמלה זמינה/)).toBeInTheDocument();
  });

  it("shows an unavailable status with formatted conflict dates", () => {
    renderRow({
      value: {
        dressId: "dress-1",
        startDate: "2026-06-12",
        endDate: "2026-06-16",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-0")).toHaveAttribute(
      "data-status",
      "unavailable"
    );
    expect(screen.getByText(/השמלה אינה זמינה/)).toBeInTheDocument();
    expect(screen.getByText(/10\/06\/2026 עד 14\/06\/2026/)).toBeInTheDocument();
  });

  it("does not show live availability for an invalid date range", () => {
    renderRow({
      value: {
        dressId: "dress-1",
        startDate: "2026-06-20",
        endDate: "2026-06-10",
        quantity: 1,
      },
    });

    expect(screen.queryByTestId("availability-0")).not.toBeInTheDocument();
  });

  it("disables the quantity input until a dress is picked", () => {
    renderRow();
    expect(screen.getByLabelText(/כמות/)).toBeDisabled();
  });

  it("caps quantity at 1 when inventory is null (effective inventory = 1)", () => {
    renderRow({
      value: { dressId: "dress-1", startDate: "", endDate: "", quantity: 1 },
    });

    const qty = screen.getByLabelText(/כמות/) as HTMLInputElement;
    expect(qty.max).toBe("1");
    expect(screen.getByText(/מלאי זמין: 1/)).toBeInTheDocument();
  });

  it("shows remaining-in-range when dates are picked", () => {
    const dressesWithCap: Dress[] = [
      { id: "dress-1", name: "שמלה אדומה", inventory: 3 },
    ];
    const partial: OrderLine[] = [
      { id: "p1", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    renderRow({
      dresses: dressesWithCap,
      orderLines: partial,
      value: {
        dressId: "dress-1",
        startDate: "2026-07-11",
        endDate: "2026-07-11",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-hint-0")).toHaveTextContent(
      /2 מתוך 3/
    );
    const qty = screen.getByLabelText(/כמות/) as HTMLInputElement;
    expect(qty.max).toBe("2");
  });

  it("clamps quantity automatically when remaining decreases", () => {
    const dressesWithCap: Dress[] = [
      { id: "dress-1", name: "שמלה אדומה", inventory: 3 },
    ];
    const partial: OrderLine[] = [
      { id: "p1", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    const onChange = vi.fn();

    // The current quantity is 3 but remaining is only 2 → the effect should
    // immediately emit a clamped quantity of 2.
    renderRow({
      dresses: dressesWithCap,
      orderLines: partial,
      value: {
        dressId: "dress-1",
        startDate: "2026-07-11",
        endDate: "2026-07-11",
        quantity: 3,
      },
      onChange,
    });

    expect(onChange).toHaveBeenCalled();
    const clampedCall = onChange.mock.calls.find(
      ([next]) => next.quantity === 2
    );
    expect(clampedCall).toBeDefined();
  });

  it("marks a partially-booked range as available with the remaining count", () => {
    const dressesWithCap: Dress[] = [
      { id: "dress-1", name: "שמלה אדומה", inventory: 3 },
    ];
    const partial: OrderLine[] = [
      { id: "p1", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
      { id: "p2", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    renderRow({
      dresses: dressesWithCap,
      orderLines: partial,
      value: {
        dressId: "dress-1",
        startDate: "2026-07-11",
        endDate: "2026-07-11",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-0")).toHaveAttribute(
      "data-status",
      "available"
    );
    expect(screen.getByTestId("availability-hint-0")).toHaveTextContent(
      /1 מתוך 3/
    );
  });

  it("marks a fully-reserved range as unavailable", () => {
    const dressesWithCap: Dress[] = [
      { id: "dress-1", name: "שמלה אדומה", inventory: 2 },
    ];
    const fullyReserved: OrderLine[] = [
      { id: "p1", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
      { id: "p2", dressId: "dress-1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    renderRow({
      dresses: dressesWithCap,
      orderLines: fullyReserved,
      value: {
        dressId: "dress-1",
        startDate: "2026-07-11",
        endDate: "2026-07-11",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-0")).toHaveAttribute(
      "data-status",
      "unavailable"
    );
  });

  it("marks the live red-dress order as unavailable when one CRM row reserves quantity 2", () => {
    const redDress: Dress[] = [
      {
        id: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        name: "שמלה אדומה",
        inventory: 2,
      },
    ];
    const liveReservation: OrderLine[] = [
      {
        id: "0a454ad3-d5fe-4797-954e-1892f4bf6121",
        dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        startDate: "2026-05-14",
        endDate: "2026-05-17",
        quantity: 2,
      },
    ];

    renderRow({
      dresses: redDress,
      orderLines: liveReservation,
      value: {
        dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        startDate: "2026-05-14",
        endDate: "2026-05-17",
        quantity: 1,
      },
    });

    expect(screen.getByTestId("availability-0")).toHaveAttribute(
      "data-status",
      "unavailable"
    );
    expect(screen.getByTestId("availability-hint-0")).toHaveTextContent(
      /0 מתוך 2/
    );
  });

  it("clamps quantity to the inventory cap and emits the clamped value", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const dressesWithCap: Dress[] = [
      { id: "dress-1", name: "שמלה אדומה", inventory: 3 },
    ];
    renderRow({
      dresses: dressesWithCap,
      value: { dressId: "dress-1", startDate: "", endDate: "", quantity: 1 },
      onChange,
    });

    const qty = screen.getByLabelText(/כמות/) as HTMLInputElement;
    expect(qty.max).toBe("3");
    expect(screen.getByText(/מלאי זמין: 3/)).toBeInTheDocument();

    await user.clear(qty);
    await user.type(qty, "9");

    const lastCall = onChange.mock.calls.at(-1)?.[0];
    expect(lastCall.quantity).toBeLessThanOrEqual(3);
    expect(lastCall.quantity).toBeGreaterThanOrEqual(1);
  });

  it("renders field and range validation errors in the right places", () => {
    const errors: ValidationError[] = [
      { code: "missing_dress", message: "יש לבחור שמלה", index: 0 },
      { code: "missing_start_date", message: "יש לבחור תאריך התחלה", index: 0 },
      { code: "missing_end_date", message: "יש לבחור תאריך סיום", index: 0 },
      { code: "date_conflict", message: "השמלה תפוסה", index: 0 },
    ];

    renderRow({ errors });

    expect(screen.getByText("יש לבחור שמלה")).toBeInTheDocument();
    expect(screen.getByText("יש לבחור תאריך התחלה")).toBeInTheDocument();
    expect(screen.getByText("יש לבחור תאריך סיום")).toBeInTheDocument();
    expect(screen.getByText("השמלה תפוסה")).toBeInTheDocument();
    expect(screen.getByLabelText(/^שמלה$/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText(/תאריך התחלה/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(screen.getByLabelText(/תאריך סיום/)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
  });

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
});
