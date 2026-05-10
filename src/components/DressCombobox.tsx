import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { dressesService } from "@/services/dressesService";
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
  onChange: (dress: Dress) => void;
  placeholder?: string;
  "aria-invalid"?: boolean;
}

export function DressCombobox({
  id,
  value,
  selectedName,
  onChange,
  placeholder = "בחרו שמלה...",
  "aria-invalid": ariaInvalid,
}: DressComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 250);
  const [results, setResults] = useState<Dress[]>([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const myRequestId = ++requestId.current;
    setLoading(true);
    dressesService
      .searchDresses(debouncedQuery)
      .then((items) => {
        if (myRequestId !== requestId.current) return;
        setResults(items);
      })
      .finally(() => {
        if (myRequestId === requestId.current) setLoading(false);
      });
  }, [debouncedQuery, open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setQuery("");
    }
  }, [open]);

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
          <span className="line-clamp-1">{value ? display : placeholder}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
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
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              טוען...
            </div>
          ) : results.length === 0 ? (
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
                  <span className="line-clamp-1">{dress.name}</span>
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
