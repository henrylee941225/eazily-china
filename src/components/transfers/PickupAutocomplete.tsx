// Text field with AMap-backed suggestions used across the three
// transfer flows (Airport, Station, Hourly). Free-text is always
// accepted; search failures degrade silently to a plain input.
//
// When the user picks a suggestion, the parent gets both the display
// string (for `pickup_address`) and the resolved coordinate + full
// address (for `pickup_address_full` / `pickup_lat` / `pickup_lng`
// on `details_json`).

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { useCity } from "@/contexts/CityContext";
import { getAmapCityCode } from "@/lib/amapCities";
import { resolveAmapSuggestion, searchAmapSuggestions } from "@/lib/amapPoiSearch";
import type { AutocompleteSuggestion } from "@/lib/mapTypes";
import { toast } from "sonner";

export type PickupResolved = {
  address: string;         // what we show in the field / write to pickup_address
  address_full?: string;   // full formatted address when the provider returns one
  lat?: number;
  lng?: number;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onResolved?: (r: PickupResolved | null) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
};

export const PickupAutocomplete = ({
  value,
  onChange,
  onResolved,
  placeholder = "Hotel or address",
  className,
  autoFocus,
}: Props) => {
  const { city } = useCity();
  const [items, setItems] = useState<AutocompleteSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [resolvingKey, setResolvingKey] = useState<string | null>(null);
  // Track the last string the user picked so we don't re-search
  // against our own selection (mirrors MapView's typedDest guard).
  const pickedRef = useRef<string | null>(null);

  useEffect(() => {
    const q = value.trim();
    if (q.length < 3) {
      setItems([]);
      return;
    }
    if (pickedRef.current && pickedRef.current === q) return;

    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const results = await searchAmapSuggestions(q, {
          center: { latitude: city.center[0], longitude: city.center[1] },
          city: getAmapCityCode(city.id),
          signal: ctrl.signal,
        });
        if (ctrl.signal.aborted) return;
        setItems(results.slice(0, 6));
      } catch {
        if (!ctrl.signal.aborted) setItems([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 300);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [value, city]);

  const pick = async (s: AutocompleteSuggestion) => {
    const key = s.displayLines.join("|");
    setResolvingKey(key);
    try {
      const place = await resolveAmapSuggestion(s);
      const name =
        place?.name || place?.formattedAddress || s.displayLines[0] || "";
      if (!place?.coordinate) {
        // Degrade silently — still fill the field with the label the
        // user tapped so free-text submission works.
        onChange(name);
        pickedRef.current = name;
        setItems([]);
        setOpen(false);
        onResolved?.({ address: name });
        toast.error("Couldn't locate this place", {
          description: "Using the address as typed.",
        });
        return;
      }
      onChange(name);
      pickedRef.current = name;
      setItems([]);
      setOpen(false);
      onResolved?.({
        address: name,
        address_full: place.formattedAddress,
        lat: place.coordinate.latitude,
        lng: place.coordinate.longitude,
      });
    } finally {
      setResolvingKey(null);
    }
  };

  return (
    <div className={className ?? "relative w-full"}>
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          pickedRef.current = null;
          onResolved?.(null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full bg-transparent text-[14px] font-semibold text-ink placeholder:text-ink-tertiary focus:outline-none"
      />
      {searching && (
        <Loader2 className="pointer-events-none absolute right-1 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-ink-secondary" />
      )}
      {open && items.length > 0 && (
        <div className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-2xl border border-border bg-white shadow-soft">
          {items.map((s, i) => {
            const key = s.displayLines.join("|");
            const primary = s.displayLines[0] ?? "";
            const secondary = s.displayLines.slice(1).join(", ");
            return (
              <button
                key={`${key}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left transition hover:bg-surface-2"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]" strokeWidth={1.8} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">
                    {primary}
                  </span>
                  {secondary && (
                    <span className="mt-0.5 block truncate text-[12px] text-ink-secondary">
                      {secondary}
                    </span>
                  )}
                </span>
                {resolvingKey === key && (
                  <Loader2 className="mt-1 h-3.5 w-3.5 shrink-0 animate-spin text-ink-secondary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
