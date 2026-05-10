import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadNotFoundScreen } from "./LeadNotFoundScreen";

describe("LeadNotFoundScreen", () => {
  it("renders the Hebrew headline and body text", () => {
    render(<LeadNotFoundScreen />);
    expect(screen.getByText(/ליד לא נמצא/)).toBeInTheDocument();
    expect(
      screen.getByText(/לא נמצאה רשומת לקוח עם המזהה שסופק/)
    ).toBeInTheDocument();
  });
});
