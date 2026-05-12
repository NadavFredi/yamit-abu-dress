import { describe, it, expect } from "vitest";
import { rangesOverlap, hasConflict } from "./dateOverlap";
import type { OrderLine } from "@/types/domain";

describe("rangesOverlap (inclusive)", () => {
  it("returns true when ranges fully overlap", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-02", "2026-06-04")).toBe(true);
  });

  it("returns true when selected range starts inside existing", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-04", "2026-06-10")).toBe(true);
  });

  it("returns true when selected range ends inside existing", () => {
    expect(rangesOverlap("2026-06-05", "2026-06-10", "2026-06-01", "2026-06-06")).toBe(true);
  });

  it("returns true when ranges touch on the same day (inclusive)", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-05", "2026-06-05", "2026-06-10")).toBe(true);
  });

  it("returns false when selected ends strictly before existing starts", () => {
    expect(rangesOverlap("2026-06-01", "2026-06-04", "2026-06-05", "2026-06-10")).toBe(false);
  });

  it("returns false when selected starts strictly after existing ends", () => {
    expect(rangesOverlap("2026-06-11", "2026-06-15", "2026-06-05", "2026-06-10")).toBe(false);
  });
});

describe("hasConflict", () => {
  const orderLines: OrderLine[] = [
    { id: "ol1", dressId: "d1", startDate: "2026-06-01", endDate: "2026-06-05", quantity: 1 },
    { id: "ol2", dressId: "d1", startDate: "2026-06-20", endDate: "2026-06-25", quantity: 1 },
    { id: "ol3", dressId: "d2", startDate: "2026-06-10", endDate: "2026-06-15", quantity: 1 },
  ];

  it("detects conflict against an existing reservation for the same dress", () => {
    expect(hasConflict("d1", "2026-06-04", "2026-06-08", orderLines)).toBe(true);
  });

  it("ignores reservations for a different dress", () => {
    expect(hasConflict("d1", "2026-06-10", "2026-06-15", orderLines)).toBe(false);
  });

  it("returns false when fully outside any reservation for the dress", () => {
    expect(hasConflict("d1", "2026-06-06", "2026-06-19", orderLines)).toBe(false);
  });

  it("returns true when matching the boundary day of an existing reservation", () => {
    expect(hasConflict("d1", "2026-06-05", "2026-06-07", orderLines)).toBe(true);
  });
});
