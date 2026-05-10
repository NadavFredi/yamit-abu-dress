import type { Dress, OrderLine } from "@/types/domain";

export const MOCK_DRESSES: Dress[] = [
  {
    id: "dress-001",
    name: "שמלת ערב כחולה",
    description: "שמלת ערב ארוכה בגוון כחול רויאל",
  },
  {
    id: "dress-002",
    name: "שמלת חתונה לבנה קלאסית",
    description: "שמלת כלה לבנה עם תחרה",
  },
  {
    id: "dress-003",
    name: "שמלת ערב שחורה",
    description: "שמלת ערב קצרה בצבע שחור",
  },
  {
    id: "dress-004",
    name: "שמלת ערב בורדו",
    description: "שמלה בגוון בורדו עם פתח גב",
  },
  {
    id: "dress-005",
    name: "שמלת חתונה בוהו",
    description: "שמלת כלה בסגנון בוהו",
  },
];

export const MOCK_ORDER_LINES: OrderLine[] = [
  { id: "ol-1", dressId: "dress-001", startDate: "2026-06-01", endDate: "2026-06-05" },
  { id: "ol-2", dressId: "dress-001", startDate: "2026-07-15", endDate: "2026-07-20" },
  { id: "ol-3", dressId: "dress-002", startDate: "2026-06-10", endDate: "2026-06-14" },
  { id: "ol-4", dressId: "dress-003", startDate: "2026-08-01", endDate: "2026-08-03" },
  { id: "ol-5", dressId: "dress-004", startDate: "2026-09-12", endDate: "2026-09-16" },
];
