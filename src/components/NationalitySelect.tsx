import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import {
  NATIONALITY_ENTRIES,
  matchesNationalityQuery,
  nationalityByCode,
} from "@/data/nationalities";

type Props = {
  /** ISO 3166-1 alpha-2 code, or "" when unset. */
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  invalid?: boolean;
  id?: string;
  className?: string;
};

/**
 * Searchable nationality picker. Opens a bottom sheet with a filter field so
 * the list stays reachable above the on-screen keyboard. Stores the alpha-2
 * code, never the display string.
 */
const NationalitySelect = ({
  value,
  onChange,
  placeholder = "Select your nationality",
  invalid = false,
  id,
  className = "",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = nationalityByCode(value);

  const results = useMemo(
    () => NATIONALITY_ENTRIES.filter((n) => matchesNationalityQuery(n, query)),
    [query],
  );

  return (
    <Drawer
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <DrawerTrigger asChild>
        <button
          id={id}
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex h-[52px] w-full items-center gap-2 rounded-2xl px-4 text-left text-[15px] transition ${
            invalid
              ? "border border-[hsl(var(--brand-red))] bg-[hsl(var(--error-tint))]"
              : "border border-transparent bg-surface-2"
          } ${className}`}
        >
          {selected ? (
            <span className="flex flex-1 items-center gap-2 truncate text-ink">
              <span aria-hidden className="text-[18px] leading-none">{selected.flag}</span>
              <span className="truncate">{selected.nationality}</span>
            </span>
          ) : (
            <span className="flex-1 truncate text-[hsl(var(--text-tertiary))]">{placeholder}</span>
          )}
          <ChevronDown className="h-4 w-4 shrink-0 text-[hsl(var(--text-secondary))]" strokeWidth={2} />
        </button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle className="text-[20px] font-bold text-ink">Nationality</DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-3">
          <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-[hsl(var(--text-secondary))]" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              autoComplete="off"
              aria-label="Search nationalities"
              placeholder="Search country or nationality"
              className="w-full bg-transparent text-[15px] text-ink placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none"
            />
          </div>
        </div>

        <div
          role="listbox"
          aria-label="Nationalities"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
        >
          {results.length === 0 ? (
            <p className="px-4 py-8 text-center text-[15px] text-[hsl(var(--text-secondary))]">
              No match found
            </p>
          ) : (
            results.map((n) => {
              const isSelected = n.code === value;
              return (
                <button
                  key={n.code}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(n.code);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
                >
                  <span aria-hidden className="text-[20px] leading-none">{n.flag}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-ink">
                      {n.nationality}
                    </span>
                    <span className="block truncate text-[13px] text-[hsl(var(--text-secondary))]">
                      {n.country}
                    </span>
                  </span>
                  {isSelected && (
                    <Check className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.5} />
                  )}
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default NationalitySelect;
