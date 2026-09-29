import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, X, ChevronDown, Phone, MapPin, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { SHANGHAI_DINING } from "@/content/shanghaiDining";
import { ALL_BARS, type DirectoryVenue } from "@/lib/bars";
import { useVenueImages } from "@/hooks/useVenueImages";
import { VenueThumb } from "@/components/venue/VenueThumb";
import { VenueGallery } from "@/components/venue/VenueGallery";
import type { VenueImage } from "@/lib/venueImages";

// Build the best Maps search query for a venue. Chinese-first for reliability
// with in-China geocoders. Priority:
//   1) name_zh + address_cn (both exist)
//   2) address_cn alone (a Chinese street address geocodes precisely on its own)
//   3) name_zh + area (name_zh only)
//   4) English name + area + "Shanghai" (neither)
export const buildVenueMapsQuery = (venue: DirectoryVenue): string => {
  if (venue.name_zh && venue.address_cn) {
    return `${venue.name_zh} ${venue.address_cn}`;
  }
  if (venue.address_cn) {
    return venue.address_cn;
  }
  if (venue.name_zh) {
    return venue.area ? `${venue.name_zh} ${venue.area}` : venue.name_zh;
  }
  const parts = [venue.name, venue.area, "Shanghai"].filter(Boolean);
  return parts.join(" ");
};

/**
 * Restaurants from the dining directory plus every bar from the combined bar
 * view model (dining bars + the standalone dataset, joined at read time).
 */
const ALL_VENUES: DirectoryVenue[] = [
  ...(SHANGHAI_DINING.filter((v) => v.entity === "restaurant") as DirectoryVenue[]),
  ...ALL_BARS,
];

const PRICE_BANDS = [
  "¥15–50",
  "¥50–100",
  "¥100–200",
  "¥200–400",
  "¥400–800",
  "¥800+",
];

// Rank price bands so "Recommended" and price sorts are deterministic.
const priceRank = (band: string | null): number => {
  if (!band) return -1;
  const i = PRICE_BANDS.indexOf(band);
  return i === -1 ? -1 : i;
};

type Sort = "recommended" | "price-asc" | "price-desc";

const uniqueSorted = (values: (string | null)[]): string[] => {
  const set = new Set<string>();
  for (const v of values) if (v) set.add(v);
  return Array.from(set).sort((a, b) => a.localeCompare(b));
};

const cuisineCounts = (venues: DirectoryVenue[]): Array<[string, number]> => {
  const counts = new Map<string, number>();
  for (const v of venues) {
    if (!v.cuisine) continue;
    counts.set(v.cuisine, (counts.get(v.cuisine) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
};

type EntityFilter = "all" | "restaurant" | "bar";

const styleCounts = (venues: DirectoryVenue[]): Array<[string, number]> => {
  const counts = new Map<string, number>();
  for (const v of venues) {
    if (v.entity !== "bar" || !v.style) continue;
    counts.set(v.style, (counts.get(v.style) ?? 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
};

const EatDrinkDirectory = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const entityParam = searchParams.get("entity");
  const entity: EntityFilter =
    entityParam === "restaurant" || entityParam === "bar" ? entityParam : "all";
  const setEntity = (next: EntityFilter) => {
    const params = new URLSearchParams(searchParams);
    if (next === "all") params.delete("entity");
    else params.set("entity", next);
    setSearchParams(params, { replace: true });
    // Reset filters that don't apply to bars.
    if (next === "bar") {
      setOccasion(null);
      setMichelinOnly(false);
      setCuisine(null);
    } else if (next === "restaurant") {
      setStyle(null);
    }
  };
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [style, setStyle] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [michelinOnly, setMichelinOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("recommended");
  const [openVenue, setOpenVenue] = useState<DirectoryVenue | null>(null);
  const [moreCuisinesOpen, setMoreCuisinesOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<
    "area" | "price" | "occasion" | null
  >(null);

  const restaurantVenues = useMemo(
    () => ALL_VENUES.filter((v) => v.entity === "restaurant"),
    [],
  );
  const barVenues = useMemo(() => ALL_VENUES.filter((v) => v.entity === "bar"), []);
  const restaurantCount = restaurantVenues.length;
  const barCount = barVenues.length;

  const allCuisines = useMemo(() => cuisineCounts(ALL_VENUES), []);
  const allStyles = useMemo(() => styleCounts(barVenues), [barVenues]);
  const topCuisines = allCuisines.slice(0, 10).map(([c]) => c);
  // Guarantee "Bar" is always a one-tap chip.
  const chipCuisines = topCuisines.includes("Bar")
    ? topCuisines
    : [...topCuisines, "Bar"];
  const restCuisines = allCuisines
    .map(([c]) => c)
    .filter((c) => !chipCuisines.includes(c));

  const areas = useMemo(
    () => uniqueSorted(ALL_VENUES.map((v) => v.area)),
    [],
  );
  const occasions = useMemo(
    () => uniqueSorted(ALL_VENUES.map((v) => v.occasion)),
    [],
  );

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    let out = ALL_VENUES.filter((v) => {
      if (entity !== "all" && v.entity !== entity) return false;
      if (cuisine && v.cuisine !== cuisine) return false;
      if (style && v.style !== style) return false;
      if (area && v.area !== area) return false;
      if (price && v.price_band !== price) return false;
      if (occasion && v.occasion !== occasion) return false;
      if (michelinOnly && !v.michelin) return false;
      if (query) {
        const hay = [v.name, v.name_zh, v.cuisine, v.area]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    });
    if (sort === "recommended") {
      out = [...out].sort((a, b) => {
        const am = a.michelin ? 1 : 0;
        const bm = b.michelin ? 1 : 0;
        if (am !== bm) return bm - am;
        return priceRank(b.price_band) - priceRank(a.price_band);
      });
    } else if (sort === "price-asc") {
      out = [...out].sort(
        (a, b) => priceRank(a.price_band) - priceRank(b.price_band),
      );
    } else {
      out = [...out].sort(
        (a, b) => priceRank(b.price_band) - priceRank(a.price_band),
      );
    }
    return out;
  }, [q, entity, cuisine, style, area, price, occasion, michelinOnly, sort]);

  // One batched fetch + one batched signed-URL call for everything on screen.
  const { data: imagesBySlug } = useVenueImages(
    useMemo(() => filtered.map((v) => v.slug), [filtered]),
  );

  const activeFilters: Array<{ label: string; clear: () => void }> = [];
  if (cuisine) activeFilters.push({ label: cuisine, clear: () => setCuisine(null) });
  if (style) activeFilters.push({ label: style, clear: () => setStyle(null) });
  if (area) activeFilters.push({ label: area, clear: () => setArea(null) });
  if (price) activeFilters.push({ label: price, clear: () => setPrice(null) });
  if (occasion) activeFilters.push({ label: occasion, clear: () => setOccasion(null) });
  if (michelinOnly)
    activeFilters.push({ label: "MICHELIN only", clear: () => setMichelinOnly(false) });

  return (
    <AppLayout title="Eat & drink in Shanghai" showBack backTo="/guides/eat-and-drink">
      <div className="mx-auto w-full max-w-[440px] space-y-4">
        <p className="text-[14px] leading-relaxed text-ink-secondary">
          {ALL_VENUES.length} places, curated and verified by our team — from
          ¥15 sheng jian to three Michelin stars.
        </p>

        {/* Entity segmented control */}
        <div className="flex gap-1 rounded-full bg-[#F6F6F7] p-1">
          <SegButton
            active={entity === "restaurant"}
            onClick={() => setEntity("restaurant")}
            label={`Restaurants · ${restaurantCount}`}
          />
          <SegButton
            active={entity === "bar"}
            onClick={() => setEntity("bar")}
            label={`Bars · ${barCount}`}
          />
          <SegButton
            active={entity === "all"}
            onClick={() => setEntity("all")}
            label="All"
          />
        </div>

        {/* Search */}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary"
            strokeWidth={2}
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, cuisine or area"
            aria-label="Search venues"
            className="w-full rounded-full border-0 bg-[#F6F6F7] px-11 py-3 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none focus:ring-2 focus:ring-ink/10"
          />
        </div>

        {/* Primary chip row: cuisines (restaurants/all) or styles (bars) */}
        <div className="-mx-5 overflow-x-auto px-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {entity === "bar" ? (
            <div className="flex gap-2 whitespace-nowrap">
              <Chip
                active={style === null}
                onClick={() => setStyle(null)}
                label="All"
              />
              {allStyles.map(([s]) => (
                <Chip
                  key={s}
                  active={style === s}
                  onClick={() => setStyle(style === s ? null : s)}
                  label={s}
                />
              ))}
            </div>
          ) : (
            <div className="flex gap-2 whitespace-nowrap">
              <Chip
                active={cuisine === null}
                onClick={() => setCuisine(null)}
                label="All"
              />
              {chipCuisines.map((c) => (
                <Chip
                  key={c}
                  active={cuisine === c}
                  onClick={() => setCuisine(cuisine === c ? null : c)}
                  label={c}
                />
              ))}
              {restCuisines.length > 0 && (
                <Chip
                  active={false}
                  onClick={() => setMoreCuisinesOpen(true)}
                  label="More"
                />
              )}
            </div>
          )}
        </div>

        {/* Dropdown chips + Michelin toggle */}
        <div className="flex flex-wrap gap-2">
          <PickerChip
            label={area ?? "Area"}
            active={!!area}
            onClick={() => setPickerOpen("area")}
          />
          <PickerChip
            label={price ?? "Price"}
            active={!!price}
            onClick={() => setPickerOpen("price")}
          />
          {entity !== "bar" && (
            <>
              <PickerChip
                label={occasion ?? "Occasion"}
                active={!!occasion}
                onClick={() => setPickerOpen("occasion")}
              />
              <button
                onClick={() => setMichelinOnly((v) => !v)}
                className={`inline-flex items-center rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
                  michelinOnly
                    ? "border-ink bg-ink text-white"
                    : "border-border bg-white text-ink"
                }`}
              >
                MICHELIN only
              </button>
            </>
          )}
        </div>

        {/* Active filter pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilters.map((f) => (
              <button
                key={f.label}
                onClick={f.clear}
                className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1 text-[12px] font-medium text-white"
              >
                {f.label}
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            ))}
          </div>
        )}

        {/* Count + sort */}
        <div className="flex items-center justify-between pt-1">
          <div className="text-[13px] text-ink-secondary">
            {filtered.length} {filtered.length === 1 ? "place" : "places"}
          </div>
          <label className="inline-flex items-center gap-1 text-[13px] text-ink-secondary">
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-md border-0 bg-transparent py-0.5 pr-1 text-[13px] font-medium text-ink focus:outline-none"
            >
              <option value="recommended">Recommended</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
            </select>
          </label>
        </div>

        {/* Results */}
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#F6F6F7] px-4 py-8 text-center text-[14px] text-ink-secondary">
            No venues match those filters.
          </div>
        ) : (
          <ul className="divide-y divide-[#E2E2E2]">
            {filtered.map((v) => (
              <li key={v.slug}>
                <button
                  onClick={() => setOpenVenue(v)}
                  className="w-full py-4 text-left active:bg-[#F6F6F7]"
                >
                  <VenueThumb
                    image={
                      imagesBySlug?.[v.slug]?.find((i) => i.sortOrder === 1) ??
                      imagesBySlug?.[v.slug]?.[0]
                    }
                    name={v.name}
                  />
                  <div className="flex items-baseline gap-2">
                    <div className="text-[16px] font-semibold leading-snug text-ink">
                      {v.name}
                    </div>
                    {v.entity === "bar" && (
                      <span className="inline-flex items-center rounded-full border border-ink px-1.5 py-0 text-[10px] font-semibold uppercase tracking-[0.06em] text-ink">
                        Bar
                      </span>
                    )}
                    {v.name_zh && (
                      <div className="text-[13px] text-ink-tertiary">
                        {v.name_zh}
                      </div>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-secondary">
                    {(v.entity === "bar"
                      ? [v.style, v.area]
                      : [v.area, v.cuisine]
                    )
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {v.price_band && (
                    <div className="mt-0.5 text-[13px] text-ink-secondary">
                      {v.price_band}
                    </div>
                  )}
                  {v.description && (
                    <div className="mt-1 line-clamp-2 text-[14px] leading-snug text-ink-secondary">
                      {v.description}
                    </div>
                  )}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {v.michelin && <TextChip>{v.michelin}</TextChip>}
                    {v.entity === "bar" && !v.extended && v.style && (
                      <TextChip>{v.style}</TextChip>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Venue detail drawer */}
      <Drawer open={!!openVenue} onOpenChange={(o) => !o && setOpenVenue(null)}>
        <DrawerContent className="max-h-[92vh]">
          {openVenue && (
            <VenueDetail
              venue={openVenue}
              images={imagesBySlug?.[openVenue.slug] ?? []}
              onBook={() => {
                // Restaurants always enter the structured booking flow with
                // the venue prefilled — no chat detour, no re-picking.
                const params = new URLSearchParams();
                params.set("venueName", openVenue.name);
                if (openVenue.name_zh) params.set("venueNameZh", openVenue.name_zh);
                if (openVenue.area) params.set("venueArea", openVenue.area);
                const addr = openVenue.address_en ?? openVenue.address_cn;
                if (addr) params.set("venueAddress", addr);
                navigate(`/book/restaurant?${params.toString()}`);
              }}
              onAskConcierge={() => {
                const draft = `I'd like to book a table at ${openVenue.name}${openVenue.name_zh ? ` (${openVenue.name_zh})` : ""}`;
                navigate("/concierge/chat", {
                  state: { prefill: draft, autoSend: false, venueSlug: openVenue.slug },
                });
              }}
              onOpenMaps={() => {
                const q = buildVenueMapsQuery(openVenue);
                navigate(`/map?q=${encodeURIComponent(q)}`);
              }}
            />
          )}
        </DrawerContent>
      </Drawer>

      {/* More cuisines drawer */}
      <Drawer open={moreCuisinesOpen} onOpenChange={setMoreCuisinesOpen}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>All cuisines</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-5 pb-8">
            <div className="flex flex-wrap gap-2">
              {allCuisines.map(([c, n]) => (
                <button
                  key={c}
                  onClick={() => {
                    setCuisine(c);
                    setMoreCuisinesOpen(false);
                  }}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] ${
                    cuisine === c
                      ? "border-ink bg-ink text-white"
                      : "border-border bg-white text-ink"
                  }`}
                >
                  {c} · {n}
                </button>
              ))}
            </div>
          </div>
        </DrawerContent>
      </Drawer>

      {/* Area/Price/Occasion pickers */}
      <Drawer open={!!pickerOpen} onOpenChange={(o) => !o && setPickerOpen(null)}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>
              {pickerOpen === "area"
                ? "Area"
                : pickerOpen === "price"
                  ? "Price"
                  : "Occasion"}
            </DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-5 pb-8">
            <ul className="divide-y divide-[#E2E2E2]">
              <li>
                <button
                  onClick={() => {
                    if (pickerOpen === "area") setArea(null);
                    if (pickerOpen === "price") setPrice(null);
                    if (pickerOpen === "occasion") setOccasion(null);
                    setPickerOpen(null);
                  }}
                  className="w-full py-3 text-left text-[15px] text-ink-secondary"
                >
                  Any
                </button>
              </li>
              {(pickerOpen === "area"
                ? areas
                : pickerOpen === "price"
                  ? PRICE_BANDS
                  : occasions
              ).map((opt) => (
                <li key={opt}>
                  <button
                    onClick={() => {
                      if (pickerOpen === "area") setArea(opt);
                      if (pickerOpen === "price") setPrice(opt);
                      if (pickerOpen === "occasion") setOccasion(opt);
                      setPickerOpen(null);
                    }}
                    className="w-full py-3 text-left text-[15px] font-medium text-ink"
                  >
                    {opt}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </DrawerContent>
      </Drawer>
    </AppLayout>
  );
};

const Chip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex shrink-0 items-center rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
      active
        ? "border-ink bg-ink text-white"
        : "border-border bg-white text-ink"
    }`}
  >
    {label}
  </button>
);

const SegButton = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
      active ? "bg-ink text-white" : "text-ink-secondary"
    }`}
  >
    {label}
  </button>
);

const PickerChip = ({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`inline-flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition ${
      active
        ? "border-ink bg-ink text-white"
        : "border-border bg-white text-ink"
    }`}
  >
    {label}
    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
  </button>
);

const TextChip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full bg-[#F6F6F7] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink">
    {children}
  </span>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5">
    <span className="text-[13px] text-ink-secondary">{label}</span>
    <span className="text-right text-[14px] font-medium text-ink">{children}</span>
  </div>
);

const VenueDetail = ({
  venue,
  images,
  onBook,
  onAskConcierge,
  onOpenMaps,
}: {
  venue: DirectoryVenue;
  images: VenueImage[];
  onBook: () => void;
  onAskConcierge: () => void;
  onOpenMaps: () => void;
}) => {
  const [showEnlarged, setShowEnlarged] = useState(false);
  const [copied, setCopied] = useState(false);

  const copyChineseAddress = async () => {
    if (!venue.address_cn) return;
    try {
      await navigator.clipboard.writeText(venue.address_cn);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  };
  const showToDriverAddr =
    venue.entity === "bar" ? venue.address_cn ?? venue.address_en : venue.address_en;
  const showToDriverLabel =
    venue.entity === "bar" && venue.address_cn ? "Address (Chinese)" : "Address";

  return (
    <div className="max-h-[92vh] overflow-y-auto px-5 pb-8 pt-2">
      <VenueGallery images={images} name={venue.name} />
      <div className="mb-4">
        <h2 className="text-[22px] font-extrabold leading-tight text-ink">
          {venue.name}
        </h2>
        {venue.name_zh && (
          <div className="mt-1 text-[15px] text-ink-secondary">{venue.name_zh}</div>
        )}
        {venue.michelin && (
          <div className="mt-2">
            <TextChip>{venue.michelin}</TextChip>
          </div>
        )}
      </div>

      {/* Show to your driver */}
      {(venue.name_zh || showToDriverAddr) && (
        <button
          onClick={() => setShowEnlarged(true)}
          className="mb-4 block w-full rounded-2xl bg-[#F6F6F7] p-4 text-left active:bg-[#F3F3F4]"
        >
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Show to your driver
          </div>
          {venue.name_zh && (
            <div className="mt-1.5 text-[20px] font-bold leading-tight text-ink">
              {venue.name_zh}
            </div>
          )}
          {showToDriverAddr && (
            <div className="mt-2 text-[15px] leading-snug text-ink">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                {showToDriverLabel}
              </span>
              <div className="mt-0.5">{showToDriverAddr}</div>
            </div>
          )}
          <div className="mt-2 text-[12px] text-ink-tertiary">Tap to enlarge</div>
        </button>
      )}

      <div className="divide-y divide-[#E2E2E2]">
        {venue.area && <Row label="Area">{venue.area}</Row>}
        {venue.cuisine && <Row label="Cuisine">{venue.cuisine}</Row>}
        {venue.price_band && <Row label="Price">{venue.price_band}</Row>}
        {venue.occasion && <Row label="Occasion">{venue.occasion}</Row>}
        {venue.style && <Row label="Style">{venue.style}</Row>}
        {venue.dish_type && <Row label="Dish type">{venue.dish_type}</Row>}
        {venue.dietary && <Row label="Dietary">{venue.dietary}</Row>}
        {venue.dress_code && <Row label="Dress code">{venue.dress_code}</Row>}
        {venue.best_for && <Row label="Best for">{venue.best_for}</Row>}
        {venue.atmosphere && <Row label="Atmosphere">{venue.atmosphere}</Row>}
        {venue.signature && <Row label="Signature">{venue.signature}</Row>}
        <Row label="Hours">
          {venue.hours_verified && venue.hours ? (
            venue.hours
          ) : (
            <span className="text-ink-secondary">Check hours before visiting</span>
          )}
        </Row>
        {venue.phone && (
          <Row label="Phone">
            <a href={`tel:${venue.phone.replace(/\s+/g, "")}`} className="underline">
              {venue.phone}
            </a>
          </Row>
        )}
      </div>

      {venue.description && (
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          {venue.description}
        </p>
      )}

      {venue.address_cn && (
        <>
          <button
            onClick={copyChineseAddress}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#F6F6F7] px-4 py-3 text-[15px] font-medium text-ink active:bg-[#F3F3F4]"
          >
            Copy Chinese address
          </button>
          {copied && (
            <p className="mt-2 text-[13px] font-medium text-ink-secondary">
              Chinese address copied — show it to your driver.
            </p>
          )}
        </>
      )}

      {venue.extended !== true && (
      <button
        onClick={onOpenMaps}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-[15px] font-medium text-ink active:bg-[#F6F6F7]"
      >
        <MapPin className="h-4 w-4" strokeWidth={2} />
        Open in Maps
      </button>
      )}

      {venue.entity === "bar" ? (
        <button
          onClick={onAskConcierge}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white active:opacity-90"
        >
          <Sparkles className="h-4 w-4 text-brand-orange" strokeWidth={2} />
          Ask the concierge
        </button>
      ) : (
        <>
          <button
            onClick={onBook}
            className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white active:opacity-90"
          >
            Book this restaurant
          </button>
          <button
            onClick={onAskConcierge}
            className="mt-3 block w-full text-center text-[13px] font-medium text-ink-secondary underline underline-offset-2 active:text-ink"
          >
            Ask the concierge instead
          </button>
        </>
      )}

      {venue.last_checked && (
        <p className="mt-6 text-[13px] leading-snug text-ink-tertiary">
          {`Details last checked ${formatLastChecked(venue.last_checked)}. `}
          Hours and reservations can change — reconfirm before an important
          visit.
        </p>
      )}

      <Dialog open={showEnlarged} onOpenChange={setShowEnlarged}>
        <DialogContent className="max-w-full border-0 bg-white p-6 sm:max-w-md">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Show to your driver
          </div>
          {venue.name_zh && (
            <div className="mt-3 text-[34px] font-extrabold leading-tight text-ink">
              {venue.name_zh}
            </div>
          )}
          {showToDriverAddr && (
            <div className="mt-4 text-[22px] leading-snug text-ink">
              {showToDriverAddr}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/** ISO date to UK-readable date; falls back to the raw string if unparseable. */
const formatLastChecked = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export default EatDrinkDirectory;