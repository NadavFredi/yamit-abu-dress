import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

describe("App routes", () => {
  it("renders the request page at the root route", () => {
    renderApp("/");

    expect(screen.getByText(/חסר מזהה לקוח בקישור/)).toBeInTheDocument();
  });

  it("renders the thank-you page at /thank-you", () => {
    renderApp("/thank-you");

    expect(
      screen.getByRole("heading", { name: /הבקשה התקבלה בהצלחה/ })
    ).toBeInTheDocument();
  });

  it("redirects unknown routes back to the request page", () => {
    renderApp("/not-a-real-route");

    expect(screen.getByText(/חסר מזהה לקוח בקישור/)).toBeInTheDocument();
  });
});
