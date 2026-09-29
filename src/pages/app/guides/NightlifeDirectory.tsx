import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useVenueImages } from "@/hooks/useVenueImages";
import { VenueThumb } from "@/components/venue/VenueThumb";
import { VenueGallery } from "@/components/venue/VenueGallery";
import type { VenueImage } from "@/lib/venueImages";
import {
  getAllNightlife,
  getNightlifeAreas,
  getNightlifeTypes,
  type ShanghaiNightlifeVenue,
} from "@/lib/nightlife";

/**
 * Nightlife directory. Imagery comes from the shared venue-images lookup,
 * keyed on slug alone — one image per venue, no gallery. Venues without an
 * image collapse to a text-only card. These venues carry no coordinates:
 * no map surface, no distance readouts. Absent fields are omitted.
 */
const NightlifeDirectory = () => {
  const navigate = useNavigate();
  const all = useMemo(() => getAllNightlife(), []);
  const areas = useMemo(() => getNightlifeAreas(), []);
  const types = useMemo(() => getNightlifeTypes(), []);

  const [q, setQ] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [venueType, setVenueType] = useState<string | null>(null);
  const [picker, setPicker] = useState<"area" | "type" | null>(null);
  const [open, setOpen] = useState<ShanghaiNightlifeVenue | null>(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((v) => {
      if (area && v.area !== area) return false;
      if (venueType && v.venueType !== venueType) return false;
      if (!needle) return true;
      return [v.name, v.nameZh, v.venueType, v.music]
        .filter(Boolean)
        .some((f) => (f as string).toLowerCase().includes(needle));
    });
  }, [all, q, area, venueType]);

  // One batched fetch + one batched signed-URL call for everything on screen.
  const { data: imagesBySlug } = useVenueImages(
    useMemo(() => results.map((v) => v.slug), [results]),
  );

  const imageFor = (slug: string): VenueImage | undefined =>
    imagesBySlug?.[slug]?.find((i) => i.sortOrder === 1) ??
    imagesBySlug?.[slug]?.[0];

  return (
    <AppLayout title="Nightlife" showBack backTo="/guides/eat-and-drink">
      <div className="mx-auto w-full max-w-[440px] space-y-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search clubs, music, type"
          className="h-11 w-full rounded-[14px] bg-[#F6F6F7] px-4 text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
        />

        <div className="flex flex-wrap gap-2">
          <PickerChip
            label={area ?? "Area"}
            active={!!area}
            onClick={() => setPicker("area")}
          />
          <PickerChip
            label={venueType ?? "Venue type"}
            active={!!venueType}
            onClick={() => setPicker("type")}
          />
          {(area || venueType) && (
            <button
              onClick={() => {
                setArea(null);
                setVenueType(null);
              }}
              className="text-[13px] font-medium text-ink-secondary underline underline-offset-2"
            >
              Clear
            </button>
          )}
        </div>

        <div className="text-[13px] text-ink-secondary">
          {results.length} {results.length === 1 ? "place" : "places"}
        </div>

        {results.length === 0 ? (
          <div className="rounded-2xl bg-[#F6F6F7] px-4 py-8 text-center text-[14px] text-ink-secondary">
            No venues match those filters.
          </div>
        ) : (
          <ul className="divide-y divide-[#E2E2E2]">
            {results.map((v) => (
              <li key={v.slug}>
                <button
                  onClick={() => setOpen(v)}
                  className="w-full py-4 text-left active:bg-[#F6F6F7]"
                >
                  <VenueThumb image={imageFor(v.slug)} name={v.name} />
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[16px] font-semibold leading-snug text-ink">
                      {v.name}
                    </span>
                    {v.nameZh && (
                      <span className="text-[13px] text-ink-tertiary">
                        {v.nameZh}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[13px] text-ink-secondary">
                    {[v.venueType, v.area].filter(Boolean).join(" · ")}
                  </div>
                  {v.coverBand && (
                    <div className="mt-0.5 text-[13px] text-ink-secondary">
                      {v.coverBand}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Drawer open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DrawerContent className="max-h-[92vh]">
          {open && (
            <NightlifeDetail
              venue={open}
              image={imageFor(open.slug)}
              onBook={() => {
                const params = new URLSearchParams();
                params.set("venueName", open.name);
                if (open.nameZh) params.set("venueNameZh", open.nameZh);
                if (open.area) params.set("venueArea", open.area);
                params.set("venueAddress", open.address);
                navigate(`/book/restaurant?${params.toString()}`);
              }}
            />
          )}
        </DrawerContent>
      </Drawer>

      <Drawer open={!!picker} onOpenChange={(o) => !o && setPicker(null)}>
        <DrawerContent className="max-h-[80vh]">
          <DrawerHeader>
            <DrawerTitle>{picker === "area" ? "Area" : "Venue type"}</DrawerTitle>
          </DrawerHeader>
          <div className="max-h-[60vh] overflow-y-auto px-5 pb-8">
            <ul className="divide-y divide-[#E2E2E2]">
              <li>
                <button
                  onClick={() => {
                    if (picker === "area") setArea(null);
                    else setVenueType(null);
                    setPicker(null);
                  }}
                  className="w-full py-3 text-left text-[15px] text-ink-secondary"
                >
                  Any
                </button>
              </li>
              {(picker === "area" ? areas : types).map((opt) => (
                <li key={opt}>
                  <button
                    onClick={() => {
                      if (picker === "area") setArea(opt);
                      else setVenueType(opt);
                      setPicker(null);
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
      active ? "border-ink bg-ink text-white" : "border-border bg-white text-ink"
    }`}
  >
    {label}
    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
  </button>
);

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-4 py-2.5">
    <span className="shrink-0 text-[13px] text-ink-secondary">{label}</span>
    <span className="text-right text-[14px] font-medium text-ink">{children}</span>
  </div>
);

const NightlifeDetail = ({
  venue,
  image,
  onBook,
}: {
  venue: ShanghaiNightlifeVenue;
  image?: VenueImage;
  onBook: () => void;
}) => {
  const [copied, setCopied] = useState(false);

  const copyChineseAddress = async () => {
    try {
      await navigator.clipboard.writeText(venue.addressZh);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 4000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="max-h-[92vh] overflow-y-auto px-5 pb-8 pt-2">
      {image && <VenueGallery images={[image]} name={venue.name} />}
      <h2 className="text-[22px] font-extrabold leading-tight text-ink">
        {venue.name}
      </h2>
      {venue.nameZh && (
        <div className="mt-1 text-[15px] text-ink-secondary">{venue.nameZh}</div>
      )}
      <div className="mt-1 text-[13px] text-ink-secondary">
        {[venue.venueType, venue.area].filter(Boolean).join(" · ")}
      </div>

      <p className="mt-4 text-[15px] leading-relaxed text-ink">
        {venue.description}
      </p>

      <div className="mt-4 divide-y divide-[#E2E2E2]">
        <Row label="Music">{venue.music}</Row>
        {venue.openingHours && <Row label="Opening hours">{venue.openingHours}</Row>}
        {venue.bestNights && <Row label="Best nights">{venue.bestNights}</Row>}
        {venue.coverBand && (
          <Row label="Typical spend / cover">{venue.coverBand}</Row>
        )}
        {venue.dressCode && <Row label="Dress code">{venue.dressCode}</Row>}
        {venue.entryBooking && <Row label="Entry &amp; booking">{venue.entryBooking}</Row>}
        {venue.atmosphere && <Row label="Atmosphere">{venue.atmosphere}</Row>}
        {venue.bestFor && <Row label="Best for">{venue.bestFor}</Row>}
        {venue.lgbtqFriendly && <Row label="LGBTQ+">{venue.lgbtqFriendly}</Row>}
        {venue.verification && <Row label="Listing status">{venue.verification}</Row>}
      </div>

      <div className="mt-5 rounded-2xl bg-[#F6F6F7] p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
          Address
        </div>
        <div className="mt-1 text-[15px] leading-snug text-ink">{venue.address}</div>
        <div className="mt-1.5 text-[15px] leading-snug text-ink">
          {venue.addressZh}
        </div>
      </div>

      <button
        onClick={copyChineseAddress}
        className="mt-3 inline-flex w-full items-center justify-center rounded-full bg-[#F6F6F7] px-4 py-3 text-[15px] font-medium text-ink active:bg-[#F3F3F4]"
      >
        Copy Chinese address
      </button>
      {copied && (
        <p className="mt-2 text-[13px] font-medium text-ink-secondary">
          Chinese address copied — show it to your driver.
        </p>
      )}

      <button
        onClick={onBook}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white active:opacity-90"
      >
        <Sparkles className="h-4 w-4 text-brand-orange" strokeWidth={2} />
        Ask the concierge to book this
      </button>

      <p className="mt-6 text-[13px] leading-snug text-ink-tertiary">
        Details last checked {venue.lastChecked}. Club hours, cover charges and
        events change frequently — check the venue&apos;s own channels on the
        day.
      </p>
    </div>
  );
};

export default NightlifeDirectory;
