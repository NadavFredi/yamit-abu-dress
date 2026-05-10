import type { OrderLine } from "@/types/domain";

export const MOCK_ORDER_LINES: OrderLine[] = [
  { id: "ol-1", dressId: "dress-001", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol-2", dressId: "dress-001", startDate: "2026-07-15", endDate: "2026-07-20" },
  { id: "ol-3", dressId: "dress-002", startDate: "2026-06-10", endDate: "2026-06-14" },
  { id: "ol-4", dressId: "dress-003", startDate: "2026-08-01", endDate: "2026-08-03" },
  { id: "ol-5", dressId: "dress-004", startDate: "2026-09-12", endDate: "2026-09-16" },
];
