import { describe, expect, it } from "vitest";
import {
  buildEndDateState,
  buildStartDateState,
  dateToIsoLocal,
  formatIsoToDisplay,
  todayIsoLocal,
} from "./datePickerRules";
import type { OrderLine } from "@/types/domain";

describe("todayIsoLocal", () => {
  it("returns yyyy-mm-dd in local time matching the DatePicker format", () => {
    const fixed = new Date(2026, 4, 7, 10, 30); // 7 May 2026 local
    expect(todayIsoLocal(fixed)).toBe("2026-05-07");
  });

  it("zero-pads month and day", () => {
    const fixed = new Date(2026, 0, 3, 23, 59); // 3 Jan 2026 local
    expect(todayIsoLocal(fixed)).toBe("2026-01-03");
  });
});

const TODAY = "2026-05-07";

const bookings: OrderLine[] = [
  { id: "ol-1", dressId: "d", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol-2", dressId: "d", startDate: "2026-07-15", endDate: "2026-07-20" },
];

describe("buildStartDateState", () => {
  it("returns 'past' for dates before today", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-05-06")).toBe("past");
    expect(state("2025-12-31")).toBe("past");
  });

  it("returns null for today itself", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state(TODAY)).toBe(null);
  });

  it("returns 'booked' for any day inside an existing booking, including endpoints", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-06-01")).toBe("booked");
    expect(state("2026-06-03")).toBe("booked");
    expect(state("2026-06-05")).toBe("booked");
    expect(state("2026-07-15")).toBe("booked");
    expect(state("2026-07-20")).toBe("booked");
  });

  it("returns null for future dates outside any booking", () => {
    const state = buildStartDateState(bookings, TODAY);
    expect(state("2026-05-31")).toBe(null);
    expect(state("2026-06-06")).toBe(null);
    expect(state("2026-12-25")).toBe(null);
  });

  it("returns null for every date when there are no bookings", () => {
    const state = buildStartDateState([], TODAY);
    expect(state("2026-06-03")).toBe(null);
    expect(state("2026-07-17")).toBe(null);
  });
});

describe("buildEndDateState", () => {
  it("with empty startDate, returns 'past' for past dates and 'booked' for booked dates", () => {
    const state = buildEndDateState(bookings, TODAY, "");
    expect(state("2026-05-06")).toBe("past");
    expect(state("2026-06-03")).toBe("booked");
    expect(state("2026-06-06")).toBe(null);
  });

  it("with startDate set, returns 'past' for dates before the start date", () => {
    const state = buildEndDateState(bookings, TODAY, "2026-06-10");
    expect(state("2026-06-09")).toBe("past");
    expect(state("2026-06-10")).toBe(null);
  });

  it("with startDate before a booking, returns 'booked' for any end date that crosses the booking", () => {
    // booking 2026-06-01..2026-06-05, start 2026-05-20
    const state = buildEndDateState(bookings, TODAY, "2026-05-20");
    expect(state("2026-05-31")).toBe(null); // doesn't cross
    expect(state("2026-06-01")).toBe("booked"); // hits start of booking
    expect(state("2026-06-03")).toBe("booked"); // inside booking
    expect(state("2026-06-05")).toBe("booked"); // hits end of booking
    expect(state("2026-06-10")).toBe("booked"); // span Jun 1-5 booking — even though Jun 10 is free
    expect(state("2026-07-14")).toBe("booked"); // still spans booking
  });

  it("with startDate equal to today, treats today as a valid (null) end date", () => {
    const state = buildEndDateState(bookings, TODAY, TODAY);
    expect(state(TODAY)).toBe(null);
  });

  it("with no bookings, only 'past' is ever returned", () => {
    const state = buildEndDateState([], TODAY, "2026-06-10");
    expect(state("2026-06-09")).toBe("past");
    expect(state("2026-06-15")).toBe(null);
    expect(state("2027-01-01")).toBe(null);
  });

  it("in free gap between bookings, end date inside the gap returns null", () => {
    // bookings: Jun 1-5 and Jul 15-20; startDate Jun 6 (in the gap)
    const state = buildEndDateState(bookings, TODAY, "2026-06-06");
    expect(state("2026-06-08")).toBe(null);
  });

  it("in free gap between bookings, end date that crosses second booking returns 'booked'", () => {
    const state = buildEndDateState(bookings, TODAY, "2026-06-06");
    expect(state("2026-07-15")).toBe("booked");
  });

  it("after both bookings, end date beyond them returns null", () => {
    const state = buildEndDateState(bookings, TODAY, "2026-07-21");
    expect(state("2026-08-10")).toBe(null);
  });
});

describe("formatIsoToDisplay", () => {
  it("happy path: converts yyyy-mm-dd to dd/mm/yyyy", () => {
    expect(formatIsoToDisplay("2026-06-10")).toBe("10/06/2026");
  });

  it("preserves zero-padded single-digit month and day", () => {
    expect(formatIsoToDisplay("2026-01-03")).toBe("03/01/2026");
  });

  it("empty string returns empty string", () => {
    expect(formatIsoToDisplay("")).toBe("");
  });

  it("whitespace-only string returns empty string (no '-' parts)", () => {
    // "   ".split("-") gives ["   "]; m and d are undefined → guard returns ""
    expect(formatIsoToDisplay("   ")).toBe("");
  });

  it("malformed input 'abc' returns empty string", () => {
    expect(formatIsoToDisplay("abc")).toBe("");
  });

  it("partial input 'yyyy-mm' (missing day) returns empty string", () => {
    expect(formatIsoToDisplay("2026-06")).toBe("");
  });

  it("partial input 'yyyy' (missing month and day) returns empty string", () => {
    expect(formatIsoToDisplay("2026")).toBe("");
  });

  it("'--' (empty segments) returns empty string because year segment is falsy", () => {
    expect(formatIsoToDisplay("--")).toBe("");
  });

  it("year boundary: '0001-01-01' → '01/01/0001'", () => {
    expect(formatIsoToDisplay("0001-01-01")).toBe("01/01/0001");
  });

  it("year boundary: '9999-12-31' → '31/12/9999'", () => {
    expect(formatIsoToDisplay("9999-12-31")).toBe("31/12/9999");
  });

  it("non-zero-padded input '2026-1-3' returns '3/1/2026' (function does literal string interpolation)", () => {
    // The function does ${d}/${m}/${y} — it does NOT re-pad the segments.
    expect(formatIsoToDisplay("2026-1-3")).toBe("3/1/2026");
  });
});

describe("dateToIsoLocal", () => {
  it("happy path: May 7 2026 10:30 → '2026-05-07'", () => {
    expect(dateToIsoLocal(new Date(2026, 4, 7, 10, 30))).toBe("2026-05-07");
  });

  it("zero-pads month and day: Jan 3 2026 → '2026-01-03'", () => {
    expect(dateToIsoLocal(new Date(2026, 0, 3))).toBe("2026-01-03");
  });

  it("end of year: Dec 31 2026 → '2026-12-31'", () => {
    expect(dateToIsoLocal(new Date(2026, 11, 31))).toBe("2026-12-31");
  });

  it("leap day: Feb 29 2024 → '2024-02-29'", () => {
    expect(dateToIsoLocal(new Date(2024, 1, 29))).toBe("2024-02-29");
  });

  it("year 9999: Dec 31 9999 → '9999-12-31'", () => {
    expect(dateToIsoLocal(new Date(9999, 11, 31))).toBe("9999-12-31");
  });

  it("two-digit year via setFullYear(1): year 1 → '1-01-01'", () => {
    // new Date(1, 0, 1) is interpreted as 1901 in JS.
    // To get year 1 we must use setFullYear.
    const d = new Date();
    d.setFullYear(1, 0, 1);
    // getFullYear() returns 1; padStart is only applied to month and day
    expect(dateToIsoLocal(d)).toBe("1-01-01");
  });
});
