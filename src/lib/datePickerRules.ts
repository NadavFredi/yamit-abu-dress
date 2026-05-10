import type { OrderLine } from "@/types/domain";
import { rangesOverlap } from "@/lib/dateOverlap";

export type DateState = "past" | "booked" | null;

export function dateToIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayIsoLocal(now: Date = new Date()): string {
  return dateToIsoLocal(now);
}

export function formatIsoToDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function buildStartDateState(
  bookings: OrderLine[],
  todayIso: string
): (iso: string) => DateState {
  return (iso) => {
    if (iso < todayIso) return "past";
    for (const b of bookings) {
      if (b.startDate <= iso && iso <= b.endDate) return "booked";
    }
    return null;
  };
}

export function buildEndDateState(
  bookings: OrderLine[],
  todayIso: string,
  startDate: string
): (iso: string) => DateState {
  return (iso) => {
    if (iso < todayIso) return "past";
    if (startDate && iso < startDate) return "past";
    if (startDate) {
      for (const b of bookings) {
        if (rangesOverlap(b.startDate, b.endDate, startDate, iso)) {
          return "booked";
        }
      }
    } else {
      for (const b of bookings) {
        if (b.startDate <= iso && iso <= b.endDate) return "booked";
      }
    }
    return null;
  };
}
