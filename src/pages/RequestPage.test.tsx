import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import { RequestPage } from "./RequestPage";
import { ThankYouPage } from "./ThankYouPage";
import { appConfig } from "@/lib/appConfig";
import { expectDateDisabled, pickDate } from "@/test/datePickerHelpers";
import { pickFromSelect } from "@/test/selectHelpers";

const SUBMIT_URL = appConfig.webhooks.submitUrl;
const DRESSES_URL = appConfig.webhooks.dressesUrl;
const RESERVATIONS_URL = appConfig.webhooks.reservationsUrl;

const DRESS_NAMES = {
  "dress-001": "שמלת ערב כחולה",
  "dress-002": "שמלת חתונה לבנה קלאסית",
  "dress-005": "שמלת חתונה בוהו",
} as const;

const DEFAULT_LEAD_CONTEXT = {
  user: {
    id: "rec_123",
    entity_id: "ent",
    tenant_id: "ten",
    display_name: "Test User",
    data: {},
    computed: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  items: [
    { id: "dress-001", data: { name: DRESS_NAMES["dress-001"], picture: null } },
    { id: "dress-002", data: { name: DRESS_NAMES["dress-002"], picture: null } },
    { id: "dress-005", data: { name: DRESS_NAMES["dress-005"], picture: null } },
  ],
};

interface ReservationFixture {
  id: string;
  startDate: string;
  endDate: string;
}

const RESERVATIONS_BY_DRESS: Record<string, ReservationFixture[]> = {
  "dress-001": [
    { id: "ol-1", startDate: "2026-06-01", endDate: "2026-06-05" },
    { id: "ol-2", startDate: "2026-07-15", endDate: "2026-07-20" },
  ],
  "dress-002": [
    { id: "ol-3", startDate: "2026-06-10", endDate: "2026-06-14" },
  ],
  "dress-005": [],
};

function reservationsResponseFor(dressId: string) {
  const lines = RESERVATIONS_BY_DRESS[dressId] ?? [];
  return {
    ok: true,
    status: 200,
    json: async () => ({
      orders: lines.map((l) => ({
        id: l.id,
        data: {
          dress: dressId,
          start_rent_date: l.startDate,
          end_rent_date: l.endDate,
        },
      })),
    }),
  } as unknown as Response;
}

interface FetchOverrides {
  dresses?: () => Response | Promise<Response>;
  submit?: () => Response | Promise<Response>;
  reservations?: (
    dressId: string,
    dressName: string
  ) => Response | Promise<Response>;
}

function installFetchMock(overrides: FetchOverrides = {}) {
  const dressesHandler =
    overrides.dresses ??
    (() =>
      ({
        ok: true,
        status: 200,
        json: async () => DEFAULT_LEAD_CONTEXT,
      }) as unknown as Response);
  const submitHandler =
    overrides.submit ?? (() => ({ ok: true, status: 200 } as Response));
  const reservationsHandler =
    overrides.reservations ??
    ((dressId: string) => reservationsResponseFor(dressId));

  globalThis.fetch = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === DRESSES_URL) return dressesHandler();
      if (url === SUBMIT_URL) return submitHandler();
      if (url === RESERVATIONS_URL) {
        const body = init?.body
          ? (JSON.parse(init.body as string) as {
              dress_id: string;
              dress_name: string;
            })
          : { dress_id: "", dress_name: "" };
        return reservationsHandler(body.dress_id, body.dress_name);
      }
      throw new Error(`Unexpected fetch URL in test: ${url}`);
    }
  ) as typeof globalThis.fetch;
}

const renderApp = (initialUrl: string) =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <Routes>
        <Route path="/" element={<RequestPage />} />
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </MemoryRouter>
  );

async function waitForReservationsLoaded(rowIndex = 0) {
  await waitFor(() => {
    expect(
      screen.queryByTestId(`reservations-loading-${rowIndex}`)
    ).not.toBeInTheDocument();
  });
}

describe("RequestPage", () => {
  const originalFetch = globalThis.fetch;
  const FIXED_NOW = new Date(2026, 4, 1, 12, 0, 0); // 1 May 2026 local

  beforeEach(() => {
    vi.useFakeTimers({ now: FIXED_NOW, shouldAdvanceTime: true });
    installFetchMock();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
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
    await waitForReservationsLoaded();
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-12-01");
    await pickDate(user, screen.getByLabelText(/תאריך סיום/), "2026-12-05");

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([u]) => u === SUBMIT_URL)).toBe(true);
    });
    const submitCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u]) => u === SUBMIT_URL
    )!;
    const [url, init] = submitCall;
    expect(url).toBe(SUBMIT_URL);
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
    await waitForReservationsLoaded(0);
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
    await waitForReservationsLoaded(1);
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
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([u]) => u === SUBMIT_URL)).toBe(true);
    });
    const submitCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      ([u]) => u === SUBMIT_URL
    )!;
    const body = JSON.parse(
      (submitCall[1] as RequestInit).body as string
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
    const submitCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([u]) => u === SUBMIT_URL
    );
    expect(submitCalls).toHaveLength(0);
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
    await waitForReservationsLoaded();

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    expect(
      await screen.findByText(/יש לבחור תאריך התחלה/)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/יש לבחור תאריך סיום/)
    ).toBeInTheDocument();
    const submitCalls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.filter(
      ([u]) => u === SUBMIT_URL
    );
    expect(submitCalls).toHaveLength(0);
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
    await waitForReservationsLoaded();

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
    // dress-005 has no order lines in the fixture
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-005"]
    );
    await waitForReservationsLoaded();
    await pickDate(user, screen.getByLabelText(/תאריך התחלה/), "2026-06-01");
    await pickDate(user, screen.getByLabelText(/תאריך סיום/), "2026-06-05");

    await user.click(screen.getByRole("button", { name: /שליחת הבקשה/i }));

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([u]) => u === SUBMIT_URL)).toBe(true);
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
    await waitForReservationsLoaded();

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
    await waitForReservationsLoaded();

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
    await waitForReservationsLoaded();

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

  it("renders LoadFailedScreen when the dresses fetch rejects", async () => {
    installFetchMock({
      dresses: () =>
        ({ ok: false, status: 500 } as Response),
    });
    renderApp("/?record_id=rec_123");
    expect(
      await screen.findByText(/טעינת השמלות נכשלה/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /נסו שוב/ })
    ).toBeInTheDocument();
  });

  it("retries the fetch when the user clicks נסו שוב", async () => {
    let callCount = 0;
    installFetchMock({
      dresses: () => {
        callCount += 1;
        if (callCount === 1) {
          return { ok: false, status: 500 } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => DEFAULT_LEAD_CONTEXT,
        } as unknown as Response;
      },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByText(/טעינת השמלות נכשלה/);
    await user.click(screen.getByRole("button", { name: /נסו שוב/ }));

    expect(
      await screen.findByRole("heading", { name: /בקשת השכרת שמלות/i })
    ).toBeInTheDocument();
    expect(callCount).toBe(2);
  });

  it("renders LeadNotFoundScreen when the webhook returns user: null", async () => {
    installFetchMock({
      dresses: () =>
        ({
          ok: true,
          status: 200,
          json: async () => ({ user: null, items: [] }),
        }) as unknown as Response,
    });
    renderApp("/?record_id=rec_unknown");
    expect(
      await screen.findByText(/ליד לא נמצא/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /בקשת השכרת שמלות/i })
    ).not.toBeInTheDocument();
  });

  it("calls the reservations webhook with the picked dress id and name", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    await waitFor(() => {
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      expect(calls.some(([u]) => u === RESERVATIONS_URL)).toBe(true);
    });

    const reservationsCall = (
      globalThis.fetch as ReturnType<typeof vi.fn>
    ).mock.calls.find(([u]) => u === RESERVATIONS_URL)!;
    const body = JSON.parse((reservationsCall[1] as RequestInit).body as string);
    expect(body).toEqual({
      dress_id: "dress-001",
      dress_name: DRESS_NAMES["dress-001"],
    });
  });

  it("does not refetch reservations when the same dress is picked in two rows", async () => {
    let callCount = 0;
    installFetchMock({
      reservations: (dressId) => {
        callCount += 1;
        return reservationsResponseFor(dressId);
      },
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);

    await pickFromSelect(
      user,
      screen.getAllByLabelText(/^שמלה$/)[0],
      DRESS_NAMES["dress-001"]
    );
    await waitForReservationsLoaded(0);

    await user.click(
      screen.getByRole("button", { name: /הוספת שמלה נוספת/ })
    );

    await pickFromSelect(
      user,
      screen.getAllByLabelText(/^שמלה$/)[1],
      DRESS_NAMES["dress-001"]
    );

    // Give the second pick a chance to (not) fire a fetch.
    await waitFor(() => {
      expect(screen.getAllByLabelText(/^שמלה$/)[1]).toHaveTextContent(
        DRESS_NAMES["dress-001"]
      );
    });

    expect(callCount).toBe(1);
  });

  it("disables date pickers and shows a loading hint while reservations are in flight", async () => {
    installFetchMock({
      reservations: () => new Promise<Response>(() => {}),
    });

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderApp("/?record_id=rec_123");

    await screen.findByLabelText(/^שמלה$/);
    await pickFromSelect(
      user,
      screen.getByLabelText(/^שמלה$/),
      DRESS_NAMES["dress-001"]
    );

    expect(
      await screen.findByTestId("reservations-loading-0")
    ).toHaveTextContent(/טוען זמינות/);
    expect(screen.getByLabelText(/תאריך התחלה/)).toBeDisabled();
    expect(screen.getByLabelText(/תאריך סיום/)).toBeDisabled();
  });
});
