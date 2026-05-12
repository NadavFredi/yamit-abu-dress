import { describe, expect, it } from "vitest";
import {
  countReservedOnDay,
  effectiveInventory,
  maxReservedInRange,
  remainingForRange,
} from "./availability";
import type { Dress, OrderLine } from "@/types/domain";

const dress = (id: string, inventory: number | null): Dress => ({
  id,
  name: id,
  inventory,
});

const line = (
  id: string,
  dressId: string,
  startDate: string,
  endDate: string,
  quantity = 1
): OrderLine => ({ id, dressId, startDate, endDate, quantity });

describe("effectiveInventory", () => {
  it("returns inventory when it is a positive integer", () => {
    expect(effectiveInventory(dress("a", 3))).toBe(3);
    expect(effectiveInventory(dress("a", 1))).toBe(1);
  });

  it("returns 1 when inventory is null", () => {
    expect(effectiveInventory(dress("a", null))).toBe(1);
  });

  it("returns 1 when inventory is 0, negative, NaN, or invalid", () => {
    expect(effectiveInventory(dress("a", 0))).toBe(1);
    expect(effectiveInventory(dress("a", -2))).toBe(1);
    expect(effectiveInventory(dress("a", Number.NaN))).toBe(1);
  });

  it("returns 1 when the dress itself is null or undefined", () => {
    expect(effectiveInventory(null)).toBe(1);
    expect(effectiveInventory(undefined)).toBe(1);
  });

  it("floors fractional inventory", () => {
    expect(effectiveInventory(dress("a", 3.9))).toBe(3);
  });
});

describe("countReservedOnDay", () => {
  const lines: OrderLine[] = [
    line("a", "d1", "2026-06-10", "2026-06-14"),
    line("b", "d1", "2026-06-12", "2026-06-13"),
    line("c", "d2", "2026-06-12", "2026-06-12"),
  ];

  it("counts reservations matching the dress that include the day", () => {
    expect(countReservedOnDay(lines, "d1", "2026-06-12")).toBe(2);
    expect(countReservedOnDay(lines, "d1", "2026-06-14")).toBe(1);
    expect(countReservedOnDay(lines, "d1", "2026-06-15")).toBe(0);
  });

  it("sums quantity from each matching reservation row", () => {
    const lines: OrderLine[] = [
      line("a", "d1", "2026-06-10", "2026-06-14", 2),
      line("b", "d1", "2026-06-12", "2026-06-13", 3),
    ];
    expect(countReservedOnDay(lines, "d1", "2026-06-12")).toBe(5);
  });

  it("ignores other dresses", () => {
    expect(countReservedOnDay(lines, "d2", "2026-06-12")).toBe(1);
  });
});

describe("maxReservedInRange", () => {
  it("returns 0 when no reservations match", () => {
    expect(maxReservedInRange([], "d1", "2026-06-01", "2026-06-10")).toBe(0);
  });

  it("returns the peak overlap count across days in the range", () => {
    const lines: OrderLine[] = [
      line("a", "d1", "2026-06-10", "2026-06-14"),
      line("b", "d1", "2026-06-12", "2026-06-13"),
      line("c", "d1", "2026-06-13", "2026-06-15"),
    ];
    // 2026-06-13 is in all three lines → 3
    expect(maxReservedInRange(lines, "d1", "2026-06-10", "2026-06-15")).toBe(3);
  });

  it("uses reservation quantity when computing the peak", () => {
    const lines: OrderLine[] = [
      line("a", "d1", "2026-06-10", "2026-06-14", 2),
      line("b", "d1", "2026-06-12", "2026-06-13", 1),
    ];
    expect(maxReservedInRange(lines, "d1", "2026-06-10", "2026-06-15")).toBe(3);
  });

  it("returns 0 for empty or inverted ranges", () => {
    expect(maxReservedInRange([], "d1", "", "")).toBe(0);
    expect(maxReservedInRange([], "d1", "2026-06-10", "2026-06-05")).toBe(0);
  });
});

describe("remainingForRange", () => {
  const lines: OrderLine[] = [
    line("a", "d1", "2026-06-10", "2026-06-14"),
  ];

  it("returns full inventory when nothing overlaps", () => {
    expect(
      remainingForRange(
        dress("d1", 3),
        lines,
        "2026-08-01",
        "2026-08-05"
      )
    ).toBe(3);
  });

  it("subtracts peak reserved count from inventory", () => {
    expect(
      remainingForRange(
        dress("d1", 3),
        lines,
        "2026-06-12",
        "2026-06-12"
      )
    ).toBe(2);
  });

  it("treats null inventory as 1 unit total", () => {
    expect(
      remainingForRange(
        dress("d1", null),
        [],
        "2026-06-12",
        "2026-06-12"
      )
    ).toBe(1);
    expect(
      remainingForRange(
        dress("d1", null),
        lines,
        "2026-06-12",
        "2026-06-12"
      )
    ).toBe(0);
  });

  it("clamps at zero when reservations meet or exceed inventory", () => {
    const heavyLines: OrderLine[] = [
      line("a", "d1", "2026-06-10", "2026-06-14"),
      line("b", "d1", "2026-06-12", "2026-06-13"),
      line("c", "d1", "2026-06-13", "2026-06-13"),
    ];
    expect(
      remainingForRange(
        dress("d1", 2),
        heavyLines,
        "2026-06-13",
        "2026-06-13"
      )
    ).toBe(0);
  });
});

// Mirrors the live CRM state: 3 dresses with real inventory (3, 2, 2).
// Reservation rows can carry quantity, because Make creates one CRM row per
// booking rather than one row per unit.
describe("availability — live CRM scenario (inventory 3 / 2 / 2)", () => {
  const orange = dress("dfffa27b-6df8-4a31-a0ee-94a1a499143b", 3);
  const pink = dress("d956e6d3-2757-4003-a2d3-9904b01d485c", 2);
  const red = dress("3cd8c3e2-861c-4261-a70d-89d662bb19c2", 2);

  it("returns full inventory for each dress when nothing is booked", () => {
    expect(remainingForRange(orange, [], "2026-06-01", "2026-06-05")).toBe(3);
    expect(remainingForRange(pink, [], "2026-06-01", "2026-06-05")).toBe(2);
    expect(remainingForRange(red, [], "2026-06-01", "2026-06-05")).toBe(2);
  });

  it("subtracts overlapping reservations per-dress", () => {
    const reservations: OrderLine[] = [
      line("r1", orange.id, "2026-06-10", "2026-06-12"),
      line("r2", orange.id, "2026-06-11", "2026-06-13"),
      line("r3", pink.id, "2026-06-10", "2026-06-15"),
    ];
    // Orange peak on 06-11/06-12 = 2 booked → remaining = 3 − 2 = 1
    expect(remainingForRange(orange, reservations, "2026-06-11", "2026-06-12")).toBe(1);
    // Pink: 1 booked across the window → remaining = 2 − 1 = 1
    expect(remainingForRange(pink, reservations, "2026-06-12", "2026-06-13")).toBe(1);
    // Red: untouched
    expect(remainingForRange(red, reservations, "2026-06-12", "2026-06-13")).toBe(2);
  });

  it("blocks a fully-booked window for a pink dress (inventory 2, 2 overlapping reservations)", () => {
    const reservations: OrderLine[] = [
      line("r1", pink.id, "2026-07-01", "2026-07-05", 2),
    ];
    expect(remainingForRange(pink, reservations, "2026-07-02", "2026-07-04")).toBe(0);
  });

  it("ignores reservations belonging to other dresses", () => {
    const reservations: OrderLine[] = [
      line("r1", pink.id, "2026-07-01", "2026-07-05"),
      line("r2", pink.id, "2026-07-01", "2026-07-05"),
    ];
    // Red is fully available even though pink is fully booked in the same range
    expect(remainingForRange(red, reservations, "2026-07-02", "2026-07-04")).toBe(2);
  });
});
