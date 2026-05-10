import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LoadFailedScreen } from "./LoadFailedScreen";
import { MissingRecordIdScreen } from "./MissingRecordIdScreen";
import { MissingWebhookScreen } from "./MissingWebhookScreen";

describe("MissingRecordIdScreen", () => {
  it("explains that the EasyFlow record id is missing", () => {
    render(<MissingRecordIdScreen />);

    expect(screen.getByText(/לא ניתן להציג את הטופס/)).toBeInTheDocument();
    expect(screen.getByText(/חסר מזהה לקוח בקישור/)).toBeInTheDocument();
    expect(screen.getByText(/פתחו את הקישור מתוך מערכת EasyFlow/)).toBeInTheDocument();
  });
});

describe("MissingWebhookScreen", () => {
  it("shows the missing configuration message", () => {
    render(<MissingWebhookScreen />);

    expect(screen.getByText(/תצורה חסרה/)).toBeInTheDocument();
    expect(screen.getByText(/כתובת ה־webhook אינה מוגדרת/)).toBeInTheDocument();
  });
});

describe("LoadFailedScreen", () => {
  it("shows a retry action when loading dresses fails", () => {
    render(<LoadFailedScreen onRetry={() => {}} />);

    expect(screen.getByText(/טעינת השמלות נכשלה/)).toBeInTheDocument();
    expect(screen.getByText(/לא הצלחנו לטעון את רשימת השמלות/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /נסו שוב/ })).toBeInTheDocument();
  });

  it("calls onRetry exactly once per retry click", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<LoadFailedScreen onRetry={onRetry} />);

    await user.click(screen.getByRole("button", { name: /נסו שוב/ }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
