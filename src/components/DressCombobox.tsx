import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Dress } from "@/types/domain";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

interface DressComboboxProps {
  id?: string;
  value: string;
  selectedName?: string;
  dresses: Dress[];
  onChange: (dress: Dress) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
}

export function DressCombobox({
  id,
  value,
  selectedName,
  dresses,
  onChange,
  placeholder = "בחרו שמלה...",
  "aria-invalid": ariaInvalid,
}: DressComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

  const trimmed = query.trim().toLowerCase();
  const results = trimmed
    ? dresses.filter((d) => d.name.toLowerCase().includes(trimmed))
    : dresses;

  const display = value ? selectedName ?? value : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          id={id}
          type="button"
          aria-invalid={ariaInvalid}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-right text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            !value && "text-muted-foreground"
          )}
        >
          <span className="min-w-0 flex-1 truncate">
            {value ? display : placeholder}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="max-w-[calc(100vw-1.5rem)] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חפשו שמלה..."
              className="pr-8 h-9"
              aria-label="חיפוש שמלה"
            />
          </div>
        </div>
        <div
          className="max-h-64 overflow-auto p-1"
          role="listbox"
          data-testid="dress-combobox-list"
        >
          {results.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              לא נמצאו שמלות תואמות
            </div>
          ) : (
            results.map((dress) => {
              const selected = dress.id === value;
              return (
                <button
                  key={dress.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(dress);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-2 text-right text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                    selected && "bg-accent/60"
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{dress.name}</span>
                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
