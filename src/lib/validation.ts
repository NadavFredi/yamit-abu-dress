import type {
  Dress,
  OrderLine,
  SubmissionInput,
  ValidationError,
  ValidationResult,
} from "@/types/domain";
import { hasConflict } from "./dateOverlap";

export function validateSubmission(
  input: SubmissionInput,
  orderLines: OrderLine[],
  dresses: Dress[] = []
): ValidationResult {
  const errors: ValidationError[] = [];
  const dressById = new Map(dresses.map((d) => [d.id, d]));

  const recordId = (input.recordId ?? "").trim();
  if (!recordId) {
    errors.push({
      code: "missing_record_id",
      message: "מזהה הלקוח חסר. אנא פתחו את הקישור מתוך EasyFlow.",
    });
  }

  if (!input.selections || input.selections.length === 0) {
    errors.push({
      code: "no_dresses",
      message: "יש לבחור לפחות שמלה אחת.",
    });
  }

  const seenDressIds = new Set<string>();

  input.selections?.forEach((row, index) => {
    if (!row.dressId) {
      errors.push({
        code: "missing_dress",
        index,
        message: `שורה ${index + 1}: יש לבחור שמלה.`,
      });
    } else if (seenDressIds.has(row.dressId)) {
      errors.push({
        code: "duplicate_dress",
        index,
        message: `שורה ${index + 1}: השמלה כבר נבחרה בשורה אחרת.`,
      });
    } else {
      seenDressIds.add(row.dressId);
    }

    if (!row.startDate) {
      errors.push({
        code: "missing_start_date",
        index,
        message: `שורה ${index + 1}: יש לבחור תאריך התחלה.`,
      });
    }

    if (!row.endDate) {
      errors.push({
        code: "missing_end_date",
        index,
        message: `שורה ${index + 1}: יש לבחור תאריך סיום.`,
      });
    }

    if (row.startDate && row.endDate && row.endDate < row.startDate) {
      errors.push({
        code: "end_before_start",
        index,
        message: `שורה ${index + 1}: תאריך הסיום מוקדם מתאריך ההתחלה.`,
      });
    }

    if (
      row.dressId &&
      row.startDate &&
      row.endDate &&
      row.endDate >= row.startDate &&
      hasConflict(row.dressId, row.startDate, row.endDate, orderLines)
    ) {
      errors.push({
        code: "date_conflict",
        index,
        message: `שורה ${index + 1}: התאריכים שנבחרו אינם זמינים לשמלה זו.`,
      });
    }

    if (
      !Number.isInteger(row.quantity) ||
      row.quantity < 1
    ) {
      errors.push({
        code: "invalid_quantity",
        index,
        message: `שורה ${index + 1}: יש לבחור כמות חיובית.`,
      });
    } else if (row.dressId) {
      const dress = dressById.get(row.dressId);
      if (
        dress &&
        typeof dress.inventory === "number" &&
        row.quantity > dress.inventory
      ) {
        errors.push({
          code: "invalid_quantity",
          index,
          message: `שורה ${index + 1}: הכמות המבוקשת חורגת מהמלאי הזמין (${dress.inventory}).`,
        });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}
