import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { RequestPage } from "./RequestPage";
import { ThankYouPage } from "./ThankYouPage";
import { expectDateDisabled, pickDate } from "@/test/datePickerHelpers";
import { pickFromSelect } from "@/test/selectHelpers";

const DRESS_NAMES = {
  "dress-001": "שמלת ערב כחולה",
  "dress-002": "שמלת חתונה לבנה קלאסית",
  "dress-005": "שמלת חתונה בוהו",
} as const;

const renderApp = (initialUrl: string) =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/" element={<RequestPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </MemoryRouter>
  );

describe("RequestPage", () => {
  const originalFetch = globalThis.fetch;
  const FIXED_NOW = new Date(2026, 4, 1, 12, 0, 0); // 1 May 2026 local

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW, shouldAdvanceTime: true });
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", "https://hook.example.com/test");
    globalThis.fetch = vi.fn(async () =>
      ({ ok: true, status: 200 } as Response)
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("blocks the form when record_id is missing from the URL", () => {
    renderApp("/");
    expect(
      screen.getByText(/חסר מזהה לקוח בקישור/i)
    ).toBeInTheDocument();
  });

  it("blocks the form when record_id is empty", () => {
    renderApp("/?record_id=");
    expect(
      screen.getByText(/חסר מזהה לקוח בקישור/i)
    ).toBeInTheDocument();
  });

  it("renders the form when a record_id is provided", async () => {
    renderApp("/?record_id=rec_123");
    expect(
      await screen.findByRole("heading", { name: /בקשת השכרת שמלות/i })
    ).toBeInTheDocument();
    expect(await screen.findByLabelText(/^שמלה$/)).toBeInTheDocument();
  });

  it("submits successfully for a single available dress and redirects", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);

    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-12-01");
    await pickDate(user, screen.getByLabelText(/תאריך סיום/), "2026-12-05");

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>)
      .mock.calls[0];
    expect(url).toBe("https://hook.example.com/test");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.customer_record_id).toBe("rec_123");
    expect(body.selected_dresses).toHaveLength(1);
    expect(body.selected_dresses[0]).toMatchObject({
      dress_id: "dress-001",
      start_date: "2026-12-01",
      end_date: "2026-12-05",
    });
    expect(typeof body.submission_timestamp).toBe("string");

    expect(
      await screen.findByText(/הבקשה התקבלה בהצלחה/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ניצור איתך קשר בהקדם להמשך טיפול/)
    ).toBeInTheDocument();
  });

  it("submits successfully when multiple available dresses are selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_456");

    await screen.findAllByLabelText(/^שמלה$/);

    const firstDressSelect = screen.getAllByLabelText(/^שמלה$/)[0];
    await pickFromSelect(user, firstDressSelect, DRESS_NAMES["dress-001"]);
    await pickDate(
      user,
      screen.getAllByLabelText(/תאריך התחלה/)[0],
      "2026-12-01"
    );
    await pickDate(
      user,
      screen.getAllByLabelText(/תאריך סיום/)[0],
      "2026-12-05"
    );

    await user.click(
      screen.getByRole("button", { name: /הוספת שמלה נוספת/ })
    );

    const secondDressSelect = screen.getAllByLabelText(/^שמלה$/)[1];
    await pickFromSelect(user, secondDressSelect, DRESS_NAMES["dress-002"]);
    await pickDate(
      user,
      screen.getAllByLabelText(/תאריך התחלה/)[1],
      "2026-12-20"
    );
    await pickDate(
      user,
      screen.getAllByLabelText(/תאריך סיום/)[1],
      "2026-12-22"
    );

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });

    const body = JSON.parse(
      ((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit)
        .body as string
    );
    expect(body.selected_dresses).toHaveLength(2);
    expect(
      await screen.findByText(/הבקשה התקבלה בהצלחה/)
    ).toBeInTheDocument();
  });

  it("blocks submission when no dress is selected", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);

    // With the new design, date pickers are disabled until a dress is chosen.
    expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
    expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    expect(
      await screen.findByText(/יש לבחור שמלה/)
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("blocks submission when start or end date is missing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    expect(
      await screen.findByText(/יש לבחור תאריך התחלה/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/יש לבחור תאריך סיום/)
    ).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("shows live availability feedback as the user picks dates", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    // Pick a valid (available) range — outside any booking and in the future.
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-12-01");
    await pickDate(user, screen.getByLabelText(/תאריך סיום/), "2026-12-05");

    await waitFor(() => {
      const status = screen.getByTestId("availability-0");
      expect(status).toHaveAttribute("data-status", "available");
      expect(status).toHaveTextContent(/השמלה זמינה/);
    });
  });

  it("filters the dress list as the user types in the combobox search", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await user.click(screen.getByLabelText(/^שמלה$/));

    expect(
      await screen.findByRole("option", { name: DRESS_NAMES["dress-001"] })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: DRESS_NAMES["dress-002"] })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/חיפוש שמלה/), "בוהו");

    await waitFor(() => {
      expect(
        screen.queryByRole("option", { name: DRESS_NAMES["dress-001"] })
      ).not.toBeInTheDocument();
    });

    expect(
      screen.getByRole("option", { name: DRESS_NAMES["dress-005"] })
    ).toBeInTheDocument();
  });

  it("shows an empty-state message when the search has no results", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await user.click(screen.getByLabelText(/^שמלה$/));

    await screen.findByRole("option", { name: DRESS_NAMES["dress-001"] });
    await user.type(
      screen.getByLabelText(/חיפוש שמלה/),
      "אין כזו שמלה"
    );

    expect(
      await screen.findByText(/לא נמצאו שמלות תואמות/)
    ).toBeInTheDocument();
  });

  it("allows the same dates for a different dress that is not booked then", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    // dress-005 has no order lines in the mock data
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-005"]
    );
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-06-01");
    await pickDate(user, screen.getByLabelText(/תאריך סיום/), "2026-06-05");

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    });
    expect(
      await screen.findByText(/הבקשה התקבלה בהצלחה/)
    ).toBeInTheDocument();
  });

  it("disables both date pickers and shows a hint until a dress is selected", async () => {
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);

    expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
    expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();
    expect(screen.getByTestId("pick-dress-hint-0")).toHaveTextContent(
      /בחרו שמלה תחילה/
    );
  });

  it("marks dates that overlap an existing reservation as disabled in the start-date picker", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    // dress-001 has a booking 2026-06-01..2026-06-05
    await expectDateDisabled(
      user,
      screen.getByLabelText(/תאריך התחלה/),
      "2026-06-03",
      "booked"
    );
  });

  it("marks dates before today as disabled in the start-date picker", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    // FIXED_NOW is 2026-05-01; 2026-04-15 is in the past.
    await expectDateDisabled(
      user,
      screen.getByLabelText(/תאריך התחלה/),
      "2026-04-15",
      "past"
    );
  });

  it("marks end dates that would cross an existing booking as disabled", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    // dress-001 has a booking 2026-06-01..2026-06-05.
    // Pick start before the booking; end on the far side should be disabled.
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-05-20");

    await expectDateDisabled(
      user,
      screen.getByLabelText(/תאריך סיום/),
      "2026-06-10",
      "booked"
    );
  });
});

describe("RequestPage missing webhook configuration", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_MAKE_WEBHOOK_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("shows the configuration error screen when no webhook url is set", () => {
    renderApp("/?record_id=rec_123");
    expect(
      screen.getByText(/כתובת ה־webhook אינה מוגדרת/)
    ).toBeInTheDocument();
  });
});
