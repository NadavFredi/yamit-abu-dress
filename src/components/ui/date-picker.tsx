import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  dateToIsoLocal,
  formatIsoToDisplay,
  type DateState,
} from "@/lib/datePickerRules";

interface DatePickerProps {
  id?: string;
  value: string; // ISO yyyy-mm-dd, or "" when empty
  onChange: (next: string) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
  disabled?: boolean;
  dateState?: (iso: string) => DateState;
  legend?: React.ReactNode;
}

function parseISO(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function DatePicker({
  id,
  value,
  onChange,
  placeholder = "בחרו תאריך",
  "aria-invalid": ariaInvalid,
  disabled,
  dateState,
  legend,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);
  const selected = parseISO(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span>{value ? formatIsoToDisplay(value) : placeholder}</span>
          <CalendarIcon className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          selected={selected}
          dateState={dateState}
          legend={legend}
          onSelect={(date) => {
            if (!date) return;
            onChange(dateToIsoLocal(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
