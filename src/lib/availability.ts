import { addDays, format, parseISO } from "date-fns";
import { rangesOverlap } from "@/lib/dateOverlap";
import type { Dress, OrderLine } from "@/types/domain";

export function effectiveInventory(
  dress: Dress | null | undefined
): number {
  if (!dress) return 1;
  const inv = dress.inventory;
  if (typeof inv !== "number" || !Number.isFinite(inv) || inv < 1) return 1;
  return Math.floor(inv);
}

export function countReservedOnDay(
  orderLines: OrderLine[],
  dressId: string,
  isoDay: string
): number {
  let total = 0;
  for (const line of orderLines) {
    if (
      line.dressId === dressId &&
      line.startDate <= isoDay &&
      isoDay <= line.endDate
    ) {
      total += Math.max(1, line.quantity);
    }
  }
  return total;
}

export function maxReservedInRange(
  orderLines: OrderLine[],
  dressId: string,
  startDate: string,
  endDate: string
): number {
  if (!startDate || !endDate || endDate < startDate) return 0;
  const relevant = orderLines.filter(
    (l) =>
      l.dressId === dressId &&
      rangesOverlap(l.startDate, l.endDate, startDate, endDate)
  );
  if (relevant.length === 0) return 0;

  let max = 0;
  let curr = parseISO(startDate);
  const last = parseISO(endDate);
  while (curr <= last) {
    const day = format(curr, "yyyy-MM-dd");
    let countOnDay = 0;
    for (const l of relevant) {
      if (l.startDate <= day && day <= l.endDate) {
        countOnDay += Math.max(1, l.quantity);
      }
    }
    if (countOnDay > max) max = countOnDay;
    curr = addDays(curr, 1);
  }
  return max;
}

export function remainingForRange(
  dress: Dress | null | undefined,
  orderLines: OrderLine[],
  startDate: string,
  endDate: string
): number {
  const cap = effectiveInventory(dress);
  if (!dress) return cap;
  const peak = maxReservedInRange(orderLines, dress.id, startDate, endDate);
  return Math.max(0, cap - peak);
}
