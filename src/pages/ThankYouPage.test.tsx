import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ThankYouPage } from "./ThankYouPage";
import type { WebhookPayload } from "@/types/domain";

function renderThankYou(state?: Record<string, unknown>) {
  return render(
    <MemoryRouter
      initialEntries={[{ pathname: "/thank-you", state: state ?? null }]}
    >
      <Routes>
        <Route path="/thank-you" element={<ThankYouPage />} />
      </Routes>
    </MemoryRouter>
  );
}

const fakeSummary: WebhookPayload = {
  customer_record_id: "rec_test",
  submission_timestamp: "2026-05-07T10:00:00.000Z",
  source: "yamit-abu-dress-website",
  selected_dresses: [
    {
      dress_id: "dress-001",
      dress_name: "שמלת ערב כחולה",
      start_date: "2026-06-10",
      end_date: "2026-06-14",
          quantity: 1,
      notes: null,
    },
  ],
};

describe("ThankYouPage – success heading", () => {
  it("renders the success heading", () => {
    renderThankYou({ summary: fakeSummary });
    expect(
      screen.getByRole("heading", { name: /הבקשה התקבלה בהצלחה/ })
    ).toBeInTheDocument();
  });
});

describe("ThankYouPage – dress list", () => {
  it("renders the dress name for each selected dress", () => {
    renderThankYou({ summary: fakeSummary });
    expect(screen.getByText("שמלת ערב כחולה")).toBeInTheDocument();
  });

  it("renders the dates formatted as dd/mm/yyyy עד dd/mm/yyyy", () => {
    renderThankYou({ summary: fakeSummary });
    expect(screen.getByText("10/06/2026 עד 14/06/2026")).toBeInTheDocument();
  });

  it("renders the quantity for each selected dress", () => {
    const multiQtySummary: WebhookPayload = {
      ...fakeSummary,
      selected_dresses: [
        {
          dress_id: "dress-001",
          dress_name: "שמלת ערב כחולה",
          start_date: "2026-06-10",
          end_date: "2026-06-14",
          quantity: 2,
          notes: null,
        },
      ],
    };
    renderThankYou({ summary: multiQtySummary });
    expect(screen.getByText("כמות: 2")).toBeInTheDocument();
  });

  it("falls back to dress_id when dress_name is null", () => {
    const summaryNullName: WebhookPayload = {
      ...fakeSummary,
      selected_dresses: [
        {
          dress_id: "dress-999",
          dress_name: null,
          start_date: "2026-07-01",
          end_date: "2026-07-05",
          quantity: 1,
          notes: null,
        },
      ],
    };
    renderThankYou({ summary: summaryNullName });
    expect(screen.getByText("dress-999")).toBeInTheDocument();
  });

  it("renders multiple dresses when selected_dresses has more than one entry", () => {
    const multiSummary: WebhookPayload = {
      ...fakeSummary,
      selected_dresses: [
        {
          dress_id: "dress-001",
          dress_name: "שמלת ערב כחולה",
          start_date: "2026-06-10",
          end_date: "2026-06-14",
          quantity: 1,
          notes: null,
        },
        {
          dress_id: "dress-002",
          dress_name: "שמלת חתונה לבנה קלאסית",
          start_date: "2026-07-20",
          end_date: "2026-07-22",
          quantity: 1,
          notes: null,
        },
      ],
    };
    renderThankYou({ summary: multiSummary });
    expect(screen.getByText("שמלת ערב כחולה")).toBeInTheDocument();
    expect(screen.getByText("שמלת חתונה לבנה קלאסית")).toBeInTheDocument();
    expect(screen.getByText("20/07/2026 עד 22/07/2026")).toBeInTheDocument();
  });
});

describe("ThankYouPage – no summary in state", () => {
  it("does NOT render the dress list section when no summary is in location.state", () => {
    renderThankYou(); // no state
    // The summary section has the heading "סיכום הבקשה"
    expect(screen.queryByText("סיכום הבקשה")).not.toBeInTheDocument();
  });
});

describe("ThankYouPage – empty selected_dresses", () => {
  it("does NOT render the dress list section when selected_dresses is empty", () => {
    const emptySummary: WebhookPayload = {
      ...fakeSummary,
      selected_dresses: [],
    };
    renderThankYou({ summary: emptySummary });
    expect(screen.queryByText("סיכום הבקשה")).not.toBeInTheDocument();
  });
});
