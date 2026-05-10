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
  { id: "dress-1", name: "שמלה אדומה" },
  { id: "dress-2", name: "שמלה כחולה" },
];

const orderLines: OrderLine[] = [
  {
    id: "order-1",
    dressId: "dress-1",
    startDate: "2026-06-10",
    endDate: "2026-06-14",
  },
];

function renderRow(
  overrides: Partial<React.ComponentProps<typeof DressRow>> = {}
) {
  const props: React.ComponentProps<typeof DressRow> = {
    index: 0,
    value: { dressId: "", startDate: "", endDate: "" },
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
    });
  });

  it("disables date pickers and shows a loading hint while reservations load", () => {
    renderRow({
      value: { dressId: "dress-1", startDate: "", endDate: "" },
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
      value: { dressId: "dress-1", startDate: "", endDate: "" },
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
      },
    });

    expect(screen.queryByTestId("availability-0")).not.toBeInTheDocument();
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
});
