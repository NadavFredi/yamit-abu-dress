import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import type { DateState } from "@/lib/datePickerRules";

const WEEKDAYS = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export interface CalendarProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  selected?: Date;
  onSelect?: (date: Date | undefined) => void;
  month?: Date;
  onMonthChange?: (month: Date) => void;
  showOutsideDays?: boolean;
  /** Returns a non-null kind for disabled days; null/undefined means enabled. */
  dateState?: (iso: string) => DateState;
  /** Optional legend rendered below the day grid. */
  legend?: React.ReactNode;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameDay(a?: Date, b?: Date) {
  return Boolean(
    a &&
      b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
  );
}

function buildMonthDays(currentMonth: Date, showOutsideDays: boolean) {
  const firstDay = startOfMonth(currentMonth);
  const lastDay = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() + 1,
    0
  );
  const days: Array<{ date: Date; outside: boolean }> = [];
  const offset = firstDay.getDay();

  for (let index = offset - 1; index >= 0; index -= 1) {
    const date = new Date(firstDay);
    date.setDate(firstDay.getDate() - (index + 1));
    days.push({ date, outside: true });
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push({
      date: new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day),
      outside: false,
    });
  }

  let trailingDay = 1;
  while (days.length % 7 !== 0) {
    days.push({
      date: new Date(
        currentMonth.getFullYear(),
        currentMonth.getMonth() + 1,
        trailingDay
      ),
      outside: true,
    });
    trailingDay += 1;
  }

  return showOutsideDays ? days : days.filter((day) => !day.outside);
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    month: "long",
    year: "numeric",
  }).format(date);
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("he-IL", { month: "long" }).format(
    new Date(2024, index, 1)
  )
);

type CalendarView = "days" | "months" | "years";

function getYearPageStart(year: number) {
  return year - (year % 12);
}

export function Calendar({
  className,
  selected,
  onSelect,
  month,
  onMonthChange,
  showOutsideDays = true,
  dateState,
  legend,
  ...props
}: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(
    month ?? selected ?? new Date()
  );
  const [view, setView] = React.useState<CalendarView>("days");

  React.useEffect(() => {
    if (month) setInternalMonth(month);
  }, [month]);

  const days = React.useMemo(
    () => buildMonthDays(internalMonth, showOutsideDays),
    [internalMonth, showOutsideDays]
  );
  const today = new Date();
  const yearPageStart = React.useMemo(
    () => getYearPageStart(internalMonth.getFullYear()),
    [internalMonth]
  );
  const yearOptions = React.useMemo(
    () => Array.from({ length: 12 }, (_, index) => yearPageStart + index),
    [yearPageStart]
  );

  const commitMonth = React.useCallback(
    (nextMonth: Date) => {
      setInternalMonth(nextMonth);
      onMonthChange?.(nextMonth);
    },
    [onMonthChange]
  );

  const changeMonth = (offset: number) => {
    commitMonth(
      new Date(
        internalMonth.getFullYear(),
        internalMonth.getMonth() + offset,
        1
      )
    );
  };

  const changeYearPage = (offset: number) => {
    commitMonth(
      new Date(
        internalMonth.getFullYear() + offset,
        internalMonth.getMonth(),
        1
      )
    );
  };

  const handleLabelClick = () => {
    setView((current) => {
      if (current === "days") return "months";
      if (current === "months") return "years";
      return "months";
    });
  };

  const handleMonthSelect = (monthIndex: number) => {
    commitMonth(new Date(internalMonth.getFullYear(), monthIndex, 1));
    setView("days");
  };

  const handleYearSelect = (year: number) => {
    commitMonth(new Date(year, internalMonth.getMonth(), 1));
    setView("months");
  };

  const monthIso = `${internalMonth.getFullYear()}-${String(
    internalMonth.getMonth() + 1
  ).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "w-full rounded-lg border bg-background p-2.5 sm:p-3",
        className
      )}
      dir="rtl"
      data-testid="calendar"
      data-current-month={monthIso}
      {...props}
    >
      <div className="relative mb-3 flex items-center justify-center">
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute right-0 h-8 w-8"
          )}
          onClick={() => {
            if (view === "days") changeMonth(-1);
            else if (view === "months") changeYearPage(-1);
            else changeYearPage(-12);
          }}
          aria-label="חודש קודם"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="rounded-md px-2 py-1 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground"
          onClick={handleLabelClick}
        >
          {view === "days"
            ? formatMonthLabel(internalMonth)
            : view === "months"
              ? String(internalMonth.getFullYear())
              : `${yearPageStart} - ${yearPageStart + 11}`}
        </button>
        <button
          type="button"
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon" }),
            "absolute left-0 h-8 w-8"
          )}
          onClick={() => {
            if (view === "days") changeMonth(1);
            else if (view === "months") changeYearPage(1);
            else changeYearPage(12);
          }}
          aria-label="חודש הבא"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {view === "days" ? (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="py-1 font-medium">
                {weekday}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map(({ date, outside }) => {
              const iso = `${date.getFullYear()}-${String(
                date.getMonth() + 1
              ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
              const state = dateState?.(iso) ?? null;
              const disabled = state !== null;
              return (
                <button
                  key={iso}
                  type="button"
                  aria-label={iso}
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  data-disabled={disabled ? "true" : undefined}
                  data-disabled-kind={state ?? undefined}
                  className={cn(
                    "flex aspect-square w-full min-w-0 items-center justify-center rounded-md text-sm transition-colors",
                    !disabled &&
                      "hover:bg-accent hover:text-accent-foreground",
                    outside && !disabled && "text-muted-foreground/50",
                    isSameDay(date, today) && "border border-primary/30",
                    !disabled &&
                      isSameDay(date, selected) &&
                      "bg-primary text-primary-foreground hover:bg-primary/90",
                    state === "booked" &&
                      "text-red-400 line-through bg-red-50/40 cursor-not-allowed",
                    state === "past" &&
                      "text-muted-foreground/40 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (disabled) return;
                    onSelect?.(date);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          {legend ? <div className="mt-3">{legend}</div> : null}
        </>
      ) : null}

      {view === "months" ? (
        <div className="grid grid-cols-3 gap-2">
          {MONTH_LABELS.map((label, monthIndex) => {
            const isSelectedMonth = Boolean(
              selected &&
                selected.getFullYear() === internalMonth.getFullYear() &&
                selected.getMonth() === monthIndex
            );
            return (
              <button
                key={label}
                type="button"
                className={cn(
                  "flex h-14 items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  monthIndex === today.getMonth() &&
                    internalMonth.getFullYear() === today.getFullYear() &&
                    "border border-primary/30",
                  isSelectedMonth &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => handleMonthSelect(monthIndex)}
              >
                {label}
              </button>
            );
          })}
        </div>
      ) : null}

      {view === "years" ? (
        <div className="grid grid-cols-3 gap-2">
          {yearOptions.map((year) => {
            const isSelectedYear = Boolean(
              selected && selected.getFullYear() === year
            );
            return (
              <button
                key={year}
                type="button"
                className={cn(
                  "flex h-12 items-center justify-center rounded-lg text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  year === today.getFullYear() && "border border-primary/30",
                  isSelectedYear &&
                    "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
                onClick={() => handleYearSelect(year)}
              >
                {year}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
