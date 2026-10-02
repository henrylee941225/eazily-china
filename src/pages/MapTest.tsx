import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Search,
  LocateFixed,
  Loader2,
  X,
  MapPin,
  Utensils,
  Hotel,
  Landmark,
  TrainFront,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import ECMap, {
  type ECMapHandle,
  type Place,
  type AutocompleteSuggestion,
} from "@/components/ECMap";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PlaceSheet } from "@/components/PlaceSheet";
import { DrawerBranch } from "@/components/ui/non-modal-drawer";
import { getAmapCityCode } from "@/lib/amapCities";
import { useCity } from "@/contexts/CityContext";

type Chip = { icon: LucideIcon; label: string; query: string; glyph: string; color: string };

const CHIPS: Chip[] = [
  { icon: Utensils, label: "Food", query: "餐厅", glyph: "F", color: "#E63946" },
  { icon: Hotel, label: "Hotels", query: "酒店", glyph: "H", color: "#C9617A" },
  { icon: Landmark, label: "Attractions", query: "景点", glyph: "★", color: "#D4A33E" },
  { icon: TrainFront, label: "Transport", query: "地铁站", glyph: "M", color: "#3A6B7D" },
  { icon: ShoppingBag, label: "Shopping", query: "商场", glyph: "S", color: "#7B5B8E" },
];

export default function MapTest() {
  const mapRef = useRef<ECMapHandle>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQueryRef = useRef<string | null>(null);
  const { cityId, city } = useCity();
  const cityCode = getAmapCityCode(cityId) ?? "021";
  const poiCityCode = getAmapCityCode(cityId);
  const [activeChip, setActiveChip] = useState<string | null>(null);
  const [queryText, setQueryText] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<number | null>(null);
  const autocompleteDebounceRef = useRef<number | null>(null);
  const searchVersionRef = useRef(0);
  const autocompleteVersionRef = useRef(0);
  const suppressTextSearchRef = useRef(false);
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suppressAutocompleteRef = useRef(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [userCoord, setUserCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const activeChipRef = useRef<string | null>(null);
  activeChipRef.current = activeChip;
  const [isNavigating, setIsNavigating] = useState(false);

  // Handle a `?q=...` deep-link: seed the search box, run the shared
  // autocomplete, and open the top result exactly like a manual pick.
  // If nothing is found, leave the query in the box so the user can edit.
  useEffect(() => {
    const q = searchParams.get("q");
    if (!q || initialQueryRef.current === q) return;
    initialQueryRef.current = q;

    // Show the query in the search bar without triggering the debounced
    // text-search or opening the autocomplete dropdown.
    suppressAutocompleteRef.current = queryText !== q;
    suppressTextSearchRef.current = queryText !== q;
    setQueryText(q);
    setShowSuggestions(false);

    // Clear the URL param so refreshing doesn't re-fire the deep-link.
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    setSearchParams(next, { replace: true });

    (async () => {
      try {
        const results = (await mapRef.current?.autocomplete(q)) ?? [];
        const top = results[0];
        if (!top) return; // empty state — leave query in the box.
        const place = await mapRef.current?.resolveSuggestion(top);
        if (!place || !place.coordinate) return;
        const coord = place.coordinate as { latitude: number; longitude: number };
        mapRef.current?.clearAnnotations();
        mapRef.current?.showSinglePlace(place, undefined, "#1A1A1A");
        mapRef.current?.centerOn(coord.latitude, coord.longitude, 800);
        setActiveChip(null);
        setSelectedCategory(null);
        setSelectedPlace(place);
      } catch (e) {
        console.warn("[map] deep-link search failed", e);
      }
    })();
  }, [searchParams, setSearchParams, queryText]);

  const runSearch = async (
    query: string,
    options?: { glyph?: string; clusterId?: string; color?: string },
  ) => {
    if (!query.trim()) return;
    const version = ++searchVersionRef.current;
    setIsSearching(true);
    try {
      const count =
        (await mapRef.current?.search(query, {
          glyphText: options?.glyph,
          clusterId: options?.clusterId,
          color: options?.color,
        })) ?? 0;
      if (version === searchVersionRef.current && count === 0) {
        toast("No places found nearby", { duration: 3000 });
      }
    } catch (e) {
      if (version === searchVersionRef.current) {
        console.error("search failed", e);
        toast("Place search is unavailable. Please try again.", { duration: 3000 });
      }
    } finally {
      if (version === searchVersionRef.current) setIsSearching(false);
    }
  };

  const handlePlaceSelect = (place: Place) => {
    // Any time a place opens (pin tap, etc.) close the autocomplete dropdown
    setShowSuggestions(false);
    setSuggestions([]);
    setSelectedPlace(place);
    setSelectedCategory(activeChipRef.current);
  };

  // Debounce text-input searches (chip taps bypass via direct runSearch)
  useEffect(() => {
    if (suppressTextSearchRef.current) {
      suppressTextSearchRef.current = false;
      return;
    }
    if (!queryText.trim()) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      runSearch(queryText);
    }, 600);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [queryText]);

  const handleChipTap = (chip: Chip) => {
    if (activeChip === chip.label) {
      searchVersionRef.current++;
      setIsSearching(false);
      setActiveChip(null);
      mapRef.current?.clearAnnotations();
      return;
    }
    setActiveChip(chip.label);
    runSearch(chip.query, { glyph: chip.glyph, clusterId: chip.label, color: chip.color });
  };

  const handleClear = () => {
    autocompleteVersionRef.current++;
    setQueryText("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  // Debounced autocomplete (separate from full text search on Enter)
  useEffect(() => {
    const q = queryText.trim();
    const version = ++autocompleteVersionRef.current;
    if (autocompleteDebounceRef.current) window.clearTimeout(autocompleteDebounceRef.current);
    if (suppressAutocompleteRef.current) {
      suppressAutocompleteRef.current = false;
      return;
    }
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    autocompleteDebounceRef.current = window.setTimeout(async () => {
      try {
        const results = (await mapRef.current?.autocomplete(q)) ?? [];
        if (version !== autocompleteVersionRef.current) return;
        setSuggestions(results.slice(0, 6));
        setShowSuggestions(results.length > 0);
      } catch (error) {
        if (version !== autocompleteVersionRef.current) return;
        console.warn("Place suggestions failed", error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 250);
    return () => {
      if (autocompleteDebounceRef.current) window.clearTimeout(autocompleteDebounceRef.current);
    };
  }, [queryText]);

  // Close dropdown on outside click / Escape
  useEffect(() => {
    if (!showSuggestions) return;
    const onDown = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowSuggestions(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [showSuggestions]);

  const handleSuggestionPick = async (s: AutocompleteSuggestion) => {
    const title = s.displayLines[0] ?? "";
    // Close the dropdown immediately and keep it closed when queryText updates
    suppressAutocompleteRef.current = queryText !== title;
    suppressTextSearchRef.current = queryText !== title;
    autocompleteVersionRef.current++;
    setShowSuggestions(false);
    setSuggestions([]);
    setQueryText(title);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    let place: Place | null | undefined;
    try {
      place = await mapRef.current?.resolveSuggestion(s);
    } catch (error) {
      console.warn("Place resolution failed", error);
    }
    if (!place || !place.coordinate) {
      toast("Couldn't open this place", { duration: 2500 });
      return;
    }
    const coord = place.coordinate as { latitude: number; longitude: number };
    mapRef.current?.clearAnnotations();
    mapRef.current?.showSinglePlace(place, undefined, "#1A1A1A");
    mapRef.current?.centerOn(coord.latitude, coord.longitude, 800);
    setActiveChip(null);
    setSelectedCategory(null);
    setSelectedPlace(place);
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-background">
      {/* Full-screen map area */}
      <DrawerBranch className="flex-1 relative min-h-0">
        <ECMap
          ref={mapRef}
          onPlaceSelect={handlePlaceSelect}
          onUserLocation={setUserCoord}
          fallbackCenter={{ latitude: city.center[0], longitude: city.center[1] }}
          cityCode={cityCode}
          poiCityCode={poiCityCode}
        />

        {/* Floating search bar */}
        <div
          ref={searchWrapRef}
          className={`absolute left-0 right-0 z-10 transition-opacity duration-300 ${
            isNavigating ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{
            paddingTop: "calc(env(safe-area-inset-top) + 16px)",
            paddingLeft: 16,
            paddingRight: 16,
            top: 0,
            background: "transparent",
          }}
        >
          <div className="flex items-center gap-2 h-12 rounded-full bg-surface-elevated shadow-lg" style={{ paddingLeft: 16, paddingRight: 16 }}>
            {isSearching ? (
              <Loader2 className="h-5 w-5 text-ink-secondary shrink-0 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-ink-secondary shrink-0" />
            )}
            <input
              type="text"
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              onFocus={() => {
                if (suggestions.length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (debounceRef.current) window.clearTimeout(debounceRef.current);
                  setShowSuggestions(false);
                  runSearch(queryText);
                }
              }}
              placeholder="Search restaurants, attractions, metro stations…"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm text-ink placeholder:text-ink-tertiary"
            />
            {queryText && (
              <button
                type="button"
                aria-label="Clear search"
                onClick={handleClear}
                className="shrink-0 flex items-center justify-center"
              >
                <X className="h-5 w-5 text-ink-secondary" />
              </button>
            )}
          </div>

          {/* Autocomplete dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div
              className="mt-2 rounded-lg bg-surface-elevated shadow-xl overflow-y-auto"
              style={{ maxHeight: "50vh" }}
            >
              {suggestions.map((s, i) => {
                const title = s.displayLines[0] ?? "";
                const subtitle = s.displayLines.slice(1).join(" · ");
                return (
                  <button
                    key={`${title}-${i}`}
                    type="button"
                    onClick={() => handleSuggestionPick(s)}
                    className={`w-full text-left flex items-start gap-3 px-4 py-3 active:bg-background border-b border-border ${
                      i === 0 ? "border-t border-border" : ""
                    }`}
                  >
                    <MapPin className="h-4 w-4 text-ink-secondary shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-ink truncate">{title}</p>
                      {subtitle && (
                        <p className="text-xs text-ink-secondary truncate mt-0.5">{subtitle}</p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Chips */}
          <div className="mt-3" style={{ marginLeft: -16, marginRight: -16, paddingLeft: 16, paddingRight: 16 }}>
            <style>{`.chip-row::-webkit-scrollbar{display:none}`}</style>
            <div
              className="chip-row flex gap-2 overflow-x-auto"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {CHIPS.map((c) => {
                const selected = activeChip === c.label;
                const Icon = c.icon;
                return (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() => handleChipTap(c)}
                    aria-pressed={selected}
                    className={`h-9 px-4 rounded-full text-sm font-medium whitespace-nowrap flex items-center gap-1.5 transition-colors flex-shrink-0 border ${
                      selected
                        ? "bg-ink text-white border-ink shadow-sm"
                        : "bg-white text-ink border-border shadow-sm"
                    }`}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.9} />
                    <span>{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Recenter button */}
        <button
          type="button"
          aria-label="Recenter"
          onClick={() => mapRef.current?.recenter()}
          className={`absolute z-10 h-11 w-11 rounded-full bg-surface-elevated shadow-lg flex items-center justify-center transition-opacity duration-300 ${
            isNavigating ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
          style={{ bottom: "calc(88px + env(safe-area-inset-bottom))", right: 16 }}
        >
          <LocateFixed className="h-5 w-5 text-ink" />
        </button>
      </DrawerBranch>

      {/* Bottom nav */}
      <DrawerBranch
        className={`transition-opacity duration-300 ${isNavigating ? "opacity-50" : "opacity-100"}`}
      >
        <BottomTabBar />
      </DrawerBranch>

      <PlaceSheet
        place={selectedPlace}
        category={selectedCategory}
        userCoord={userCoord}
        mapHandle={mapRef.current}
        onClose={() => setSelectedPlace(null)}
        onNavigatingChange={setIsNavigating}
      />
    </div>
  );
}
