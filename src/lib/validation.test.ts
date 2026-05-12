import { describe, it, expect } from "vitest";
import { validateSubmission } from "./validation";
import type { Dress, OrderLine } from "@/types/domain";

const orderLines: OrderLine[] = [
  { id: "ol1", dressId: "d1", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol2", dressId: "d2", startDate: "2026-06-10", endDate: "2026-06-15" },
];

const dressesWithInventory: Dress[] = [
  { id: "d1", name: "d1", inventory: 3 },
  { id: "d2", name: "d2", inventory: null },
];

describe("validateSubmission", () => {
  it("accepts a single dress with available dates", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("accepts multiple dresses with available dates", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
          { dressId: "d2", startDate: "2026-08-01", endDate: "2026-08-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(true);
  });

  it("blocks when record_id is missing", () => {
    const result = validateSubmission(
      {
        recordId: null,
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_record_id")).toBe(true);
  });

  it("blocks when record_id is empty string", () => {
    const result = validateSubmission(
      {
        recordId: "   ",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_record_id")).toBe(true);
  });

  it("blocks when no dresses selected", () => {
    const result = validateSubmission(
      { recordId: "rec_123", selections: [] },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "no_dresses")).toBe(true);
  });

  it("blocks when a row is missing the dress id", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_dress")).toBe(true);
  });

  it("blocks when start date is missing", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [{ dressId: "d1", startDate: "", endDate: "2026-07-05", quantity: 1 }],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_start_date")).toBe(true);
  });

  it("blocks when end date is missing", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [{ dressId: "d1", startDate: "2026-07-01", endDate: "", quantity: 1 }],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "missing_end_date")).toBe(true);
  });

  it("blocks when end is before start", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "end_before_start")).toBe(true);
  });

  it("blocks when selected dates conflict for the same dress", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-06-04", endDate: "2026-06-08", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "date_conflict")).toBe(true);
  });

  it("does not block when overlapping range is for a different dress", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-06-10", endDate: "2026-06-15", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(true);
  });

  it("blocks duplicate dress selection", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
          { dressId: "d1", startDate: "2026-08-01", endDate: "2026-08-05", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "duplicate_dress")).toBe(true);
  });

  it("attaches the row index to row-level errors", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
          { dressId: "", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
        ],
      },
      orderLines
    );
    expect(result.ok).toBe(false);
    const rowErr = result.errors.find((e) => e.code === "missing_dress");
    expect(rowErr?.index).toBe(1);
  });

  it("blocks when quantity exceeds the dress inventory", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 5 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_quantity")).toBe(true);
  });

  it("blocks when quantity is zero or non-integer", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 0 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_quantity")).toBe(true);
  });

  it("does not block when inventory is null and any positive quantity is requested", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d2", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 50 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(true);
  });
});
