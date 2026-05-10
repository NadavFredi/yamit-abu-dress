import type { OrderLine } from "@/types/domain";

export function rangesOverlap(
  existingStart: string,
  existingEnd: string,
  selectedStart: string,
  selectedEnd: string
): boolean {
  return existingStart <= selectedEnd && existingEnd >= selectedStart;
}

export function hasConflict(
  dressId: string,
  startDate: string,
  endDate: string,
  orderLines: OrderLine[]
): boolean {
  return orderLines.some(
    (line) =>
      line.dressId === dressId &&
      rangesOverlap(line.startDate, line.endDate, startDate, endDate)
  );
}

export function findConflicts(
  dressId: string,
  startDate: string,
  endDate: string,
  orderLines: OrderLine[]
): OrderLine[] {
  return orderLines.filter(
    (line) =>
      line.dressId === dressId &&
      rangesOverlap(line.startDate, line.endDate, startDate, endDate)
  );
}
