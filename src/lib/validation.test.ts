import { describe, it, expect } from "vitest";
import { validateSubmission } from "./validation";
import type { Dress, OrderLine } from "@/types/domain";

const orderLines: OrderLine[] = [
  { id: "ol1", dressId: "d1", startDate: "2026-06-01", endDate: "2026-06-05", quantity: 1 },
  { id: "ol2", dressId: "d2", startDate: "2026-06-10", endDate: "2026-06-15", quantity: 1 },
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

  it("treats inventory: null as 1 unit (rejects quantity > 1)", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d2", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 2 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "invalid_quantity")).toBe(true);
  });

  it("allows quantity 1 for a dress with inventory: null in a free range", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d2", startDate: "2026-07-01", endDate: "2026-07-05", quantity: 1 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(true);
  });

  it("blocks inventory:null dress when one reservation already overlaps", () => {
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d2", startDate: "2026-06-12", endDate: "2026-06-13", quantity: 1 },
        ],
      },
      orderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "date_conflict")).toBe(true);
  });

  it("allows partial-reservation overlap up to remaining units", () => {
    const partialOrderLines: OrderLine[] = [
      { id: "p1", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-11", endDate: "2026-07-11", quantity: 2 },
        ],
      },
      partialOrderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(true);
  });

  it("blocks when partial-reservation leaves fewer units than requested", () => {
    const partialOrderLines: OrderLine[] = [
      { id: "p1", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 1 },
    ];
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-11", endDate: "2026-07-11", quantity: 3 },
        ],
      },
      partialOrderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    const qtyErr = result.errors.find((e) => e.code === "invalid_quantity");
    expect(qtyErr?.message).toMatch(/2/);
  });

  it("counts reservation row quantity when validating remaining units", () => {
    const partialOrderLines: OrderLine[] = [
      { id: "p1", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-12", quantity: 2 },
    ];
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-11", endDate: "2026-07-11", quantity: 2 },
        ],
      },
      partialOrderLines,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    const qtyErr = result.errors.find((e) => e.code === "invalid_quantity");
    expect(qtyErr?.message).toMatch(/1/);
  });

  it("rejects the live red-dress May 14-17 range when order_qty already uses all inventory", () => {
    const redDress: Dress[] = [
      {
        id: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        name: "שמלה אדומה",
        inventory: 2,
      },
    ];
    const liveReservations: OrderLine[] = [
      {
        id: "0a454ad3-d5fe-4797-954e-1892f4bf6121",
        dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
        startDate: "2026-05-14",
        endDate: "2026-05-17",
        quantity: 2,
      },
    ];

    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          {
            dressId: "3cd8c3e2-861c-4261-a70d-89d662bb19c2",
            startDate: "2026-05-14",
            endDate: "2026-05-17",
            quantity: 1,
          },
        ],
      },
      liveReservations,
      redDress
    );

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "date_conflict")).toBe(true);
  });

  it("blocks fully-reserved range (peak reserved >= inventory)", () => {
    const fullyReserved: OrderLine[] = [
      { id: "f1", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-15", quantity: 1 },
      { id: "f2", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-15", quantity: 1 },
      { id: "f3", dressId: "d1", startDate: "2026-07-10", endDate: "2026-07-15", quantity: 1 },
    ];
    const result = validateSubmission(
      {
        recordId: "rec_123",
        selections: [
          { dressId: "d1", startDate: "2026-07-11", endDate: "2026-07-11", quantity: 1 },
        ],
      },
      fullyReserved,
      dressesWithInventory
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "date_conflict")).toBe(true);
  });
});
