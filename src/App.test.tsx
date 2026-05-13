import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { signOut } from "@/lib/auth";

function renderApp(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>
  );
}

function seedAuthenticated() {
  window.localStorage.setItem("yamit-abu-dress:auth", "1");
}

describe("App routes (authenticated)", () => {
  beforeEach(() => {
    seedAuthenticated();
  });

  afterEach(() => {
    signOut();
  });

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

describe("App routes (unauthenticated)", () => {
  beforeEach(() => {
    signOut();
  });

  it("redirects protected routes to /login", () => {
    renderApp("/");

    expect(
      screen.getByRole("heading", { name: /כניסה למערכת/ })
    ).toBeInTheDocument();
  });

  it("renders the login page directly", () => {
    renderApp("/login");

    expect(
      screen.getByRole("heading", { name: /כניסה למערכת/ })
    ).toBeInTheDocument();
  });
});
