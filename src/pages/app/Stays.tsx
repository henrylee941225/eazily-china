import { AppLayout } from "@/components/AppLayout";
import { useCity } from "@/contexts/CityContext";
import { isCapacitorApp, openExternalUrl } from "@/integrations/capacitor";
import { Plane, Train, ArrowUpRight, Sparkles, Gem, Building2, PiggyBank, Users, Briefcase, Heart } from "lucide-react";

const SID = "2336054"; // Trip.com partner ref slot — replace if you have your own

// Trip.com internal IDs: hotels use a numeric city ID, flights use IATA airport codes.
// Without these, /hotels/list and /flights/showfarefirst return empty/404 pages.
// Fallback: trip.com home if a city isn't mapped (still better than a 404).
// Trip.com themed landing pages live at /hotels/{theme}/city/cn/{slug}.html
// and are genuinely different pages (distinct hotel sets, not the same SERP
// with query params). The slug is the lowercase English city name.
const TRIP_CITY: Record<string, { slug: string; iata: string }> = {
  shanghai:    { slug: "shanghai",  iata: "SHA" },
  beijing:     { slug: "beijing",   iata: "BJS" },
  guangzhou:   { slug: "guangzhou", iata: "CAN" },
  shenzhen:    { slug: "shenzhen",  iata: "SZX" },
  chengdu:     { slug: "chengdu",   iata: "CTU" },
  hangzhou:    { slug: "hangzhou",  iata: "HGH" },
  xian:        { slug: "xi-an",     iata: "SIA" },
  suzhou:      { slug: "suzhou",    iata: "SZV" },
  nanjing:     { slug: "nanjing",   iata: "NKG" },
  chongqing:   { slug: "chongqing", iata: "CKG" },
  guilin:      { slug: "guilin",    iata: "KWL" },
  "hong-kong": { slug: "hong-kong", iata: "HKG" },
};

const buildTripUrl = (path: string, params: Record<string, string>) => {
  const u = new URL(`https://www.trip.com${path}`);
  Object.entries({ Allianceid: "", SID, ...params }).forEach(([k, v]) => {
    if (v) u.searchParams.set(k, v);
  });
  return u.toString();
};

// Trip.com supports themed city pages (verified live):
//   /hotels/luxury/city/cn/shanghai.html
//   /hotels/star5/city/cn/shanghai.html
//   /hotels/star4/city/cn/shanghai.html  ... star2/star3
//   /hotels/business/city/cn/shanghai.html
//   /hotels/family/city/cn/shanghai.html
//   /hotels/boutique/city/cn/shanghai.html
//   /hotels/romantic/city/cn/shanghai.html
// Each is a distinct landing page with a curated hotel set.
const buildHotelsThemeUrl = (cityId: string, cityName: string, theme: string) => {
  const mapping = TRIP_CITY[cityId];
  if (!mapping) {
    // Fallback: generic search by city name.
    return buildTripUrl("/hotels/", { city: cityName });
  }
  return buildTripUrl(`/hotels/${theme}/city/cn/${mapping.slug}.html`, {});
};

const buildFlightsUrl = (cityId: string) => {
  const mapping = TRIP_CITY[cityId];
  if (!mapping) return buildTripUrl("/flights/", {});
  return buildTripUrl("/flights/showfarefirst", {
    acity: mapping.iata.toLowerCase(),
    triptype: "ow",
    class: "y",
    quantity: "1",
  });
};

// Open a Trip.com page, preferring the native app via custom URL scheme
// when it's installed, falling back to the web page after a short timeout.
// The hotels themed pages already trigger Trip.com's universal-link banner,
// but /flights/* and /trains/* don't — so we wire it up explicitly.
const openTripcom = (webUrl: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
  if (isCapacitorApp()) {
    e.preventDefault();
    void openExternalUrl(webUrl);
    return;
  }
  // Desktop browsers should just go to the web — no app to open.
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  if (!isMobile) return; // let the <a href> handle it
  e.preventDefault();
  // Trip.com iOS/Android scheme: ctrip:// + the web path.
  // We pass the full https URL as the deeplink target — the app routes it.
  const scheme = `ctrip://wireless/openurl?url=${encodeURIComponent(webUrl)}`;
  let didHide = false;
  const onHide = () => {
    if (document.hidden) didHide = true;
  };
  document.addEventListener("visibilitychange", onHide);
  // Use an iframe to avoid the browser's "Open in app?" interstitial.
  const iframe = document.createElement("iframe");
  iframe.style.display = "none";
  iframe.src = scheme;
  document.body.appendChild(iframe);
  // If app didn't grab focus within 1.2s, fall back to the web page.
  setTimeout(() => {
    iframe.remove();
    document.removeEventListener("visibilitychange", onHide);
    if (!didHide) window.location.href = webUrl;
  }, 1200);
};

// Single source of truth: category → Trip.com themed page slug.
type HotelCategoryKey =
  | "luxury"
  | "boutique"
  | "business"
  | "family"
  | "budget"
  | "romantic";

const HOTEL_CATEGORY_THEME: Record<HotelCategoryKey, string> = {
  luxury:   "luxury",
  boutique: "boutique",
  // Trip.com has no "business" theme — star4 is the curated 4★ set, the same
  // hotels CBD/business travellers default to.
  business: "star4",
  family:   "family-friendly",
  // No "budget" theme; star2 is the cheapest curated set.
  budget:   "star2",
  romantic: "romantic",
};

const Stays = () => {
  const { city, cityId } = useCity();

  const hotelCategories = [
    {
      key: "luxury" as const,
      icon: Gem,
      label: "Luxury",
      hint: "5★ & premium brands",
      tag: "From ¥1,800/nt",
    },
    {
      key: "boutique" as const,
      icon: Building2,
      label: "Boutique & Design",
      hint: "Stylish, independent stays",
      tag: "Editor's pick",
    },
    {
      key: "business" as const,
      icon: Briefcase,
      label: "Business",
      hint: "Reliable 4★ near CBD",
      tag: "Free Wi-Fi & breakfast",
    },
    {
      key: "family" as const,
      icon: Users,
      label: "Family-friendly",
      hint: "Suites, pools, kids welcome",
      tag: "Family rooms",
    },
    {
      key: "budget" as const,
      icon: PiggyBank,
      label: "Budget",
      hint: "Clean, central, under ¥400",
      tag: "Best value",
    },
    {
      key: "romantic" as const,
      icon: Heart,
      label: "Romantic",
      hint: "Couples & honeymoon stays",
      tag: "Adults preferred",
    },
  ].map((c) => ({
    ...c,
    url: buildHotelsThemeUrl(cityId, city.name, HOTEL_CATEGORY_THEME[c.key]),
  }));

  const transport = [
    {
      icon: Plane,
      label: "Flights",
      hint: "Fly into / out of China",
      tag: "500+ airlines",
      url: buildFlightsUrl(cityId),
    },
    {
      icon: Train,
      label: "Trains",
      hint: "High-speed rail tickets",
      tag: "English booking",
      url: buildTripUrl("/trains/", { destination: city.name }),
    },
  ];

  return (
    <AppLayout title="Travel" subtitle={`Powered by Trip.com · ${city.name}`} backTo="/">
      <div className="mx-auto max-w-2xl space-y-5">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-foreground/10 bg-gradient-cream p-5 shadow-soft">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-glow opacity-60" />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-vermilion/20 bg-vermilion/5 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-vermilion">
              <Sparkles className="h-2.5 w-2.5" /> Book in English
            </div>
            <h2 className="font-display mt-2 text-2xl font-light leading-tight text-ink sm:text-3xl">
              Hotels, flights & tours — booked in <span className="italic text-vermilion">English</span>.
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              We hand off to Trip.com (the world's largest China-focused OTA) so you pay in your home currency and get 24/7 English support.
            </p>
          </div>
        </div>

        {/* Hotels by vibe */}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="font-display text-lg text-ink">Hotels by vibe</h3>
            <span className="text-[11px] text-muted-foreground">Pick your style</span>
          </div>
          <ul className="space-y-2">
            {hotelCategories.map(({ icon: Icon, label, hint, tag, url }) => (
              <li key={label}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 shadow-soft transition hover:border-vermilion/40 hover:bg-vermilion/5"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vermilion/10 text-vermilion transition group-hover:bg-vermilion group-hover:text-cream">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-base text-ink">{label}</span>
                      <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                        {tag}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-vermilion" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        {/* Flights & trains — horizontal row */}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h3 className="font-display text-lg text-ink">Getting there</h3>
            <span className="text-[11px] text-muted-foreground">Flights & rail</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {transport.map(({ icon: Icon, label, hint, tag, url }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={openTripcom(url)}
                className="group flex items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 shadow-soft transition hover:border-vermilion/40 hover:bg-vermilion/5"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vermilion/10 text-vermilion transition group-hover:bg-vermilion group-hover:text-cream">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{label}</div>
                  <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>
                  <div className="mt-1 inline-block rounded-full bg-muted/60 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                    {tag}
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-vermilion" />
              </a>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
};

export default Stays;
