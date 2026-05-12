import { Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { DressCombobox } from "@/components/DressCombobox";
import { findConflicts } from "@/lib/dateOverlap";
import {
  buildEndDateState,
  buildStartDateState,
  formatIsoToDisplay,
  todayIsoLocal,
} from "@/lib/datePickerRules";
import type {
  Dress,
  DressSelection,
  OrderLine,
  ValidationError,
} from "@/types/domain";

interface DressRowProps {
  index: number;
  value: DressSelection;
  dresses: Dress[];
  orderLines: OrderLine[];
  isReservationsLoading: boolean;
  errors: ValidationError[];
  canRemove: boolean;
  onChange: (next: DressSelection) => void;
  onRemove: () => void;
}

const errorCodeToField: Record<ValidationError["code"], string | null> = {
  missing_record_id: null,
  no_dresses: null,
  missing_dress: "dress",
  missing_start_date: "start",
  missing_end_date: "end",
  end_before_start: "end",
  date_conflict: "range",
  duplicate_dress: "dress",
  invalid_quantity: "quantity",
};

const QUANTITY_FALLBACK_MAX = 99;

type LiveStatus =
  | { kind: "idle" }
  | { kind: "invalid_range" }
  | { kind: "available" }
  | { kind: "unavailable"; conflicts: OrderLine[] };

function computeLiveStatus(
  value: DressSelection,
  orderLines: OrderLine[]
): LiveStatus {
  if (!value.dressId || !value.startDate || !value.endDate) {
    return { kind: "idle" };
  }
  if (value.endDate < value.startDate) {
    return { kind: "invalid_range" };
  }
  const conflicts = findConflicts(
    value.dressId,
    value.startDate,
    value.endDate,
    orderLines
  );
  return conflicts.length === 0
    ? { kind: "available" }
    : { kind: "unavailable", conflicts };
}

function CalendarLegend() {
  return (
    <div className="flex items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm bg-red-200 ring-1 ring-red-300"
        />
        תפוס
      </span>
      <span className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-sm bg-muted ring-1 ring-border"
        />
        תאריך עבר
      </span>
    </div>
  );
}

export function DressRow({
  index,
  value,
  dresses,
  orderLines,
  isReservationsLoading,
  errors,
  canRemove,
  onChange,
  onRemove,
}: DressRowProps) {
  const errorsByField = errors.reduce<Record<string, ValidationError[]>>(
    (acc, err) => {
      const field = errorCodeToField[err.code];
      if (!field) return acc;
      acc[field] = acc[field] || [];
      acc[field].push(err);
      return acc;
    },
    {}
  );

  const dressId = `dress-${index}`;
  const startId = `start-${index}`;
  const endId = `end-${index}`;
  const qtyId = `qty-${index}`;

  const reservationsForDress = value.dressId
    ? orderLines.filter((l) => l.dressId === value.dressId)
    : [];

  const dressChosen = Boolean(value.dressId);
  const selectedDress = value.dressId
    ? dresses.find((d) => d.id === value.dressId)
    : undefined;
  const inventoryCap =
    selectedDress && typeof selectedDress.inventory === "number"
      ? selectedDress.inventory
      : null;
  const quantityMax = inventoryCap ?? QUANTITY_FALLBACK_MAX;
  const reservationsReady = dressChosen && !isReservationsLoading;
  const todayIso = todayIsoLocal();
  const startDateState = reservationsReady
    ? buildStartDateState(reservationsForDress, todayIso)
    : undefined;
  const endDateState = reservationsReady
    ? buildEndDateState(reservationsForDress, todayIso, value.startDate)
    : undefined;

  const liveStatus = reservationsReady
    ? computeLiveStatus(value, orderLines)
    : { kind: "idle" as const };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">
          שמלה {index + 1}
        </h3>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onRemove}
            aria-label={`הסר שמלה ${index + 1}`}
          >
            <Trash2 className="h-4 w-4" />
            הסר
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor={dressId}>שמלה</Label>
          <DressCombobox
            id={dressId}
            value={value.dressId}
            selectedName={selectedDress?.name}
            dresses={dresses}
            onChange={(dress) => {
              const nextInventoryCap =
                typeof dress.inventory === "number" ? dress.inventory : null;
              const nextMax = nextInventoryCap ?? QUANTITY_FALLBACK_MAX;
              const clampedQty = Math.min(
                Math.max(value.quantity || 1, 1),
                Math.max(nextMax, 1)
              );
              onChange({ ...value, dressId: dress.id, quantity: clampedQty });
            }}
            aria-invalid={Boolean(errorsByField.dress)}
          />
          {errorsByField.dress?.map((e) => (
            <p key={e.code} className="text-xs text-destructive">
              {e.message}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={qtyId}>כמות</Label>
          <Input
            id={qtyId}
            type="number"
            inputMode="numeric"
            min={1}
            max={quantityMax}
            step={1}
            value={value.quantity}
            disabled={!dressChosen}
            aria-invalid={Boolean(errorsByField.quantity)}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") {
                onChange({ ...value, quantity: 1 });
                return;
              }
              const parsed = Number.parseInt(raw, 10);
              if (!Number.isFinite(parsed)) return;
              const clamped = Math.min(Math.max(parsed, 1), quantityMax);
              onChange({ ...value, quantity: clamped });
            }}
          />
          {dressChosen && inventoryCap !== null && (
            <p className="text-xs text-muted-foreground">
              מלאי זמין: {inventoryCap}
            </p>
          )}
          {errorsByField.quantity?.map((e) => (
            <p key={e.code} className="text-xs text-destructive">
              {e.message}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={startId}>תאריך התחלה</Label>
          <DatePicker
            id={startId}
            value={value.startDate}
            onChange={(next) => onChange({ ...value, startDate: next })}
            aria-invalid={Boolean(errorsByField.start)}
            disabled={!reservationsReady}
            dateState={startDateState}
            legend={reservationsReady ? <CalendarLegend /> : undefined}
          />
          {errorsByField.start?.map((e) => (
            <p key={e.code} className="text-xs text-destructive">
              {e.message}
            </p>
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={endId}>תאריך סיום</Label>
          <DatePicker
            id={endId}
            value={value.endDate}
            onChange={(next) => onChange({ ...value, endDate: next })}
            aria-invalid={Boolean(errorsByField.end || errorsByField.range)}
            disabled={!reservationsReady}
            dateState={endDateState}
            legend={reservationsReady ? <CalendarLegend /> : undefined}
          />
          {errorsByField.end?.map((e) => (
            <p key={e.code} className="text-xs text-destructive">
              {e.message}
            </p>
          ))}
        </div>
      </div>

      {errorsByField.range?.map((e) => (
        <p key={e.code} className="text-xs text-destructive">
          {e.message}
        </p>
      ))}

      {!value.dressId && (
        <div
          className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          data-testid={`pick-dress-hint-${index}`}
        >
          בחרו שמלה תחילה כדי לצפות בזמינות
        </div>
      )}

      {value.dressId && isReservationsLoading && (
        <div
          className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground"
          data-testid={`reservations-loading-${index}`}
        >
          טוען זמינות...
        </div>
      )}

      {liveStatus.kind === "available" && (
        <div
          className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 border border-green-200"
          role="status"
          data-testid={`availability-${index}`}
          data-status="available"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>השמלה זמינה לתאריכים שנבחרו</span>
        </div>
      )}

      {liveStatus.kind === "unavailable" && (
        <div
          className="flex flex-col gap-1 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200"
          role="status"
          data-testid={`availability-${index}`}
          data-status="unavailable"
        >
          <span className="flex items-center gap-2 font-medium">
            <XCircle className="h-4 w-4" />
            השמלה אינה זמינה לתאריכים שנבחרו
          </span>
          <span className="text-xs">
            מתנגש עם:{" "}
            {liveStatus.conflicts
              .map(
                (l) =>
                  `${formatIsoToDisplay(l.startDate)} עד ${formatIsoToDisplay(l.endDate)}`
              )
              .join(" · ")}
          </span>
        </div>
      )}
    </div>
  );
}
