import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  chineseVariantsFor,
  findLanguage,
  pickerSections,
  type Language,
  type LanguageCapability,
  type LanguageCode,
} from "@/data/languages";

type Props = {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  /** Capability required by the active Translate mode. */
  capability: LanguageCapability;
  title: string;
  ariaLabel: string;
  className?: string;
  /** "chinese" shows only the three Chinese variants, with no search field. */
  mode?: "full" | "chinese";
};

/**
 * Searchable language picker. Same pattern as the nationality selector: a
 * bottom sheet with a filter field so the list stays reachable above the
 * on-screen keyboard. Options are filtered by what the active mode can do.
 */
const LanguagePicker = ({
  value,
  onChange,
  capability,
  title,
  ariaLabel,
  className = "",
  mode = "full",
}: Props) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = findLanguage(value);

  const { suggested, all } = useMemo(
    () =>
      mode === "chinese"
        ? { suggested: [] as Language[], all: chineseVariantsFor(capability) }
        : pickerSections(capability, query),
    [capability, query, mode],
  );

  const pick = (code: LanguageCode) => {
    onChange(code);
    setOpen(false);
    setQuery("");
  };

  const Row = ({ l }: { l: Language }) => {
    const isSelected = l.code === value;
    return (
      <button
        type="button"
        role="option"
        aria-selected={isSelected}
        onClick={() => pick(l.code)}
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-surface-2 focus:bg-surface-2 focus:outline-none"
      >
        <span className="min-w-0 flex-1 truncate text-[15px] font-medium text-ink">
          {l.englishName}
        </span>
        {isSelected && <Check className="h-4 w-4 shrink-0 text-ink" strokeWidth={2.5} />}
      </button>
    );
  };

  const empty = suggested.length === 0 && all.length === 0;

  return (
    <>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={
          "relative flex h-11 w-full min-w-0 items-center justify-center rounded-full border border-hairline bg-white px-4 pr-8 text-[14px] font-semibold text-ink transition-colors hover:bg-surface-2 " +
          className
        }
      >
        <span className="truncate whitespace-nowrap">{selected.englishName}</span>
        <ChevronDown
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-red"
          strokeWidth={2.2}
        />
      </button>

      <Drawer
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <DrawerContent className="max-h-[85vh] border-hairline bg-white">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="text-[20px] font-bold text-ink">{title}</DrawerTitle>
          </DrawerHeader>

          {mode !== "chinese" && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[hsl(var(--text-secondary))]" strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoFocus
                autoComplete="off"
                aria-label="Search languages"
                placeholder="Search language"
                className="w-full bg-transparent text-[15px] text-ink placeholder:text-[hsl(var(--text-tertiary))] focus:outline-none"
              />
            </div>
          </div>
          )}

          <div
            role="listbox"
            aria-label={ariaLabel}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          >
            {empty ? (
              <p className="px-4 py-8 text-center text-[15px] text-[hsl(var(--text-secondary))]">
                No match found
              </p>
            ) : (
              <>
                {suggested.map((l) => <Row key={l.code} l={l} />)}
                {mode !== "chinese" && all.length > 0 && suggested.length > 0 && (
                  <div className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]">
                    All languages
                  </div>
                )}
                {all.map((l) => <Row key={l.code} l={l} />)}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export default LanguagePicker;
