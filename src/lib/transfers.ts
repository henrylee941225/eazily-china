// Shared metadata + helpers for the private transfer journey. Frontend-only —
// nothing here is enforced by the database. The details_json shape below is
// what we write on concierge_tasks.details_json for transfer bookings.

import { Car, Truck, Bus, type LucideIcon } from "lucide-react";

export type TransferService = "airport" | "hourly" | "station";

export type CarClass = "standard" | "premium" | "van" | "first" | "maybach";

// Display order used everywhere the five car classes are rendered.
export const CAR_CLASS_ORDER: CarClass[] = [
  "standard",
  "premium",
  "van",
  "first",
  "maybach",
];

export type TransferDirection = "arrival" | "departure";

// Terminal code stored in details_json. Kept short so ops-facing summaries
// stay compact ("SHA T2"). Null / undefined means "not sure" — allowed only
// on the From-airport direction.
export type TerminalCode = "T1" | "T2";

export type TerminalOption = { code: TerminalCode; label: string };

// Station journey uses a semantic direction key mirrored into details_json
// so ops/analytics don't need to reinterpret arrival/departure.
export type StationDirection = "to_station" | "from_station";

// Curated preset list for the station route step. Chinese names are kept
// alongside the English label so the picker always shows both.
export type StationPreset = {
  code: string;
  name: string;      // English name (no "Railway"/"Station" suffix duplication)
  cn: string;        // Chinese characters
  subtitle: string;  // e.g. "High-speed rail"
  lat: number;
  lng: number;
};

export const SHANGHAI_STATIONS: StationPreset[] = [
  // Only Hongqiao Railway is priced today. Other stations are unpriced —
  // keeping the list to a single preset means unpriced routes cannot be
  // booked. Add more presets once their rate-card entries exist.
  { code: "hongqiao", name: "Hongqiao Railway", cn: "虹桥站", subtitle: "High-speed rail", lat: 31.1943, lng: 121.3200 },
];

export type TransferDetails = {
  kind: "transfer";
  service: TransferService;
  car_class: CarClass;
  pax: number;
  bags: number;
  notes?: string;
  pickup_at: string;                 // ISO date-time
  pickup_address?: string;
  // Extended pickup fields written when the user picks a place suggestion
  // for the pickup address. `pickup_address` remains the human-readable
  // string ops sees on the queue; the fields below let downstream (driver
  // hand-off) show the resolved address and drop an accurate pin.
  pickup_address_full?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_address?: string;
  // Extended drop-off fields written when the user picks a place
  // suggestion for the drop-off address (e.g. From-airport / From-station).
  dropoff_address_full?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  phone?: string;
  // Traveller's contact number for the driver. Required at booking time on
  // all three transfer flows; mirrored back to profiles.phone when the
  // profile didn't already have one. Legacy tasks may only have `phone`.
  contact_phone?: string;
  // airport
  airport_code?: string;
  airport_name?: string;
  terminal?: string;
  direction?: TransferDirection;
  flight_number?: string;
  // hourly
  hours?: number;
  // hourly extras
  included_km?: number;
  route_plan?: string;
  // Aliases mirrored by the hourly form so downstream consumers can
  // pick either the generic transfer name (pickup_at, bags) or the
  // hourly-native one (start_at, luggage).
  start_at?: string;
  luggage?: number;
  // station
  station_code?: string;
  station_name?: string;
  train_number?: string;
  // Semantic station direction ("to_station" | "from_station") mirrored
  // alongside `direction` (arrival/departure) so ops has an unambiguous key.
  station_direction?: StationDirection;
  // Chinese renderings of the addresses, shown to drivers and hotel staff who
  // cannot read the English. Populated at booking time for airport/station
  // endpoints (from the presets) and by ops for free-text addresses; absent
  // means "English only", never an empty line.
  pickup_address_zh?: string;
  dropoff_address_zh?: string;
};

export const SERVICE_LABEL: Record<TransferService, string> = {
  airport: "Airport transfer",
  hourly: "Car by the hour",
  station: "Station transfer",
};

export const SERVICE_BLURB: Record<TransferService, string> = {
  airport: "To or from Shanghai's airports",
  hourly: "A driver on call for the day",
  station: "High-speed rail & maglev",
};

export const CAR_CLASS_LABEL: Record<CarClass, string> = {
  standard: "Standard",
  premium: "Premium",
  van: "Van & Group",
  first: "First Class",
  maybach: "Maybach",
};

export const CAR_CLASS_SUBTITLE: Record<CarClass, string> = {
  standard: "Up to 5 · 4 bags",
  premium: "Up to 3 · 3 bags",
  van: "Up to 6 · 6 bags",
  first: "Up to 3 · 3 bags",
  maybach: "Up to 3 · 3 bags",
};

export const CAR_CLASS_EXAMPLE: Record<CarClass, string> = {
  standard: "Buick GL8 or similar",
  premium: "Mercedes E-Class or similar",
  van: "Mercedes V-Class or similar",
  first: "Mercedes S-Class or similar",
  maybach: "Mercedes-Maybach S 480",
};

export const CAR_CLASS_ICON: Record<CarClass, LucideIcon> = {
  standard: Car,
  premium: Car,
  van: Bus,
  first: Car,
  maybach: Car,
};

// -----------------------------------------------------------------------------
// GBP-canonical rate card. ALL indicative and locked pricing derives from these
// numbers. Ops enter/adjust quotes in GBP; the customer is charged in their
// preferred currency at a marked-up FX rate. PLACEHOLDER values — replace with
// the real rate card. Keep this the single edit-point for pricing changes.
// -----------------------------------------------------------------------------

// Airport rate card, keyed by IATA code. SHA (Hongqiao Airport) shares the
// station price row — both are the Hongqiao side of Shanghai.
export const AIRPORT_RATE_CARD_GBP: Record<string, Record<CarClass, number>> = {
  SHA: { standard: 29, premium: 58, van: 72, first: 101, maybach: 173 },
  PVG: { standard: 38, premium: 72, van: 87, first: 115, maybach: 216 },
};

// Station rate card. Only Hongqiao Railway is priced today; matches SHA.
export const STATION_RATE_CARD_GBP: Record<string, Record<CarClass, number>> = {
  hongqiao: { standard: 29, premium: 58, van: 72, first: 101, maybach: 173 },
};

// Hourly rate card. `maybach` is null on the 4-hour block — the class must
// not be bookable at that duration. Included km lives alongside so the UI
// can label each preset with the correct allowance.
export const HOURLY_RATE_CARD_GBP: Record<number, Record<CarClass, number | null>> = {
  4:  { standard: 72,  premium: 87,  van: 87,  first: 130, maybach: null },
  8:  { standard: 101, premium: 130, van: 144, first: 216, maybach: 360 },
  10: { standard: 115, premium: 173, van: 173, first: 259, maybach: 403 },
};

export const HOURLY_INCLUDED_KM_BY_HOURS: Record<number, number> = {
  4: 50,
  8: 100,
  10: 100,
};

/**
 * Look up the GBP canonical price for a service+car+hours combination.
 * Returns null when nothing is defined (unknown hour block etc.). Ops can
 * still enter a custom GBP amount when the rate card doesn't cover it.
 */
export const getTransferGbpPrice = (
  service: TransferService,
  carClass: CarClass,
  hours?: number,
  routeCode?: string | null,
): number | null => {
  if (service === "hourly") {
    const h = hours ?? 4;
    const exact = HOURLY_RATE_CARD_GBP[h]?.[carClass];
    return typeof exact === "number" ? exact : null;
  }
  if (service === "airport") {
    const code = (routeCode ?? "").toUpperCase();
    return AIRPORT_RATE_CARD_GBP[code]?.[carClass] ?? null;
  }
  if (service === "station") {
    const code = routeCode ?? "";
    return STATION_RATE_CARD_GBP[code]?.[carClass] ?? null;
  }
  return null;
};

// A small, curated list of mainland airports. Extendable — kept short so the
// picker stays scannable on mobile.
export type Airport = {
  code: string;
  name: string;
  city: string;
  cn: string;
  lat: number;
  lng: number;
  terminals: TerminalOption[];
};

export const AIRPORTS: Airport[] = [
  {
    code: "PVG",
    name: "Shanghai Pudong Int'l",
    city: "Shanghai",
    cn: "浦东国际机场",
    lat: 31.1443,
    lng: 121.8083,
    terminals: [
      { code: "T1", label: "Terminal 1" },
      { code: "T2", label: "Terminal 2" },
    ],
  },
  {
    code: "SHA",
    name: "Shanghai Hongqiao Int'l",
    city: "Shanghai",
    cn: "虹桥机场",
    lat: 31.1979,
    lng: 121.3363,
    terminals: [
      { code: "T1", label: "Terminal 1" },
      { code: "T2", label: "Terminal 2" },
    ],
  },
];

// Compact human summary for the airport card subtitle ("Terminal 1 · Terminal 2").
export const airportTerminalsSummary = (a: Airport): string =>
  a.terminals.map((t) => t.label).join(" · ");

// We operate in Shanghai only; airportsForCity is kept as a thin passthrough
// so callers/tests don't need to change.
export const airportsForCity = (_cityName?: string | null): Airport[] => AIRPORTS;

export const HOURLY_OPTIONS = [4, 8, 10] as const;

// Short pickup summary used on the Bookings list card ("Fri 24 May · 9:30 am · Pudong T2").
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const TIME_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const formatPickupDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return DATE_FMT.format(d);
};

export const formatPickupTime = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return TIME_FMT.format(d).toLowerCase().replace(/\s/g, "");
};

export const buildTransferSummary = (d: TransferDetails): string => {
  const carLabel = CAR_CLASS_LABEL[d.car_class];
  if (d.service === "airport") {
    const dir = d.direction === "arrival" ? "from" : "to";
    const airport = d.airport_code ? `${d.airport_code}` : "airport";
    const term = d.terminal ? ` ${d.terminal}` : "";
    return `Airport transfer · ${dir} ${airport}${term}`;
  }
  if (d.service === "hourly") {
    const parts = ["Car by the hour"];
    if (d.hours) parts.push(`${d.hours}h`);
    const iso = d.start_at || d.pickup_at;
    if (iso) parts.push(`${formatPickupDate(iso)}, ${formatPickupTime(iso)}`);
    parts.push(carLabel);
    return parts.join(" · ");
  }
  const parts = ["Station transfer"];
  if (d.pickup_at) parts.push(`${formatPickupDate(d.pickup_at)}, ${formatPickupTime(d.pickup_at)}`);
  const dir = d.station_direction === "from_station" || d.direction === "arrival" ? "from" : "to";
  const station = d.station_name || d.station_code || "station";
  parts.push(`${dir} ${station}`);
  parts.push(carLabel);
  return parts.join(" · ");
};

export const buildTransferDetailsLine = (d: TransferDetails): string => {
  const parts: string[] = [];
  if (d.pickup_at) {
    parts.push(`${formatPickupDate(d.pickup_at)} · ${formatPickupTime(d.pickup_at)}`);
  }
  parts.push(CAR_CLASS_LABEL[d.car_class]);
  if (d.service === "airport" && d.airport_code) {
    parts.push(d.terminal ? `${d.airport_code} ${d.terminal}` : d.airport_code);
  }
  if (d.service === "station" && (d.station_code || d.station_name)) {
    parts.push(d.station_code || d.station_name || "");
  }
  if (d.service === "hourly" && d.hours) {
    parts.push(`${d.hours}h`);
  }
  return parts.filter(Boolean).join(" · ");
};

// Currency formatting reused by ops "Set quote" prompt and by the booking
// detail's quote block.
export const formatMoney = (priceCents: number, currency: string): string => {
  const value = priceCents / 100;
  const symbol = currency === "CNY" ? "¥" : currency === "GBP" ? "£" : currency === "USD" ? "$" : "";
  if (symbol) return `${symbol}${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
  return `${value.toLocaleString("en-GB", { maximumFractionDigits: 0 })} ${currency}`;
};

// Currency symbol map covering everything the app can lock a charge in.
const CURRENCY_SYMBOL: Record<string, string> = {
  CNY: "¥", USD: "$", EUR: "€", GBP: "£", JPY: "¥", HKD: "HK$",
  AUD: "A$", CAD: "C$", CHF: "Fr", SGD: "S$", NZD: "NZ$",
  KRW: "₩", INR: "₹", THB: "฿", MYR: "RM", IDR: "Rp",
  PHP: "₱", MXN: "Mex$", BRL: "R$", ZAR: "R", SEK: "kr", NOK: "kr",
};

const ZERO_DECIMAL_CCY = new Set(["JPY", "KRW", "IDR"]);

// Formats a minor-unit amount in the correct currency, respecting
// zero-decimal currencies (JPY etc.) and using the symbol where we have one.
export const formatChargeMoney = (amountMinor: number, currency: string): string => {
  const cur = (currency || "").toUpperCase();
  const symbol = CURRENCY_SYMBOL[cur];
  const isZero = ZERO_DECIMAL_CCY.has(cur);
  const value = isZero ? Math.round(amountMinor) : amountMinor / 100;
  const formatted = isZero
    ? value.toLocaleString("en-GB")
    : value.toLocaleString("en-GB", { maximumFractionDigits: 2 });
  return symbol ? `${symbol}${formatted}` : `${formatted} ${cur}`;
};

// "£55 (¥500)" — the customer-facing dual-currency label. `chargeCents` is
// in `chargeCurrency`; `cnyCents` is the locked CNY reference amount.
export const formatDualPrice = (
  chargeCents: number | null | undefined,
  chargeCurrency: string | null | undefined,
  cnyCents: number | null | undefined,
): string => {
  const cur = String(chargeCurrency ?? "").toUpperCase();
  const chargeLabel =
    chargeCents && cur ? formatChargeMoney(chargeCents, cur) : "";
  const cnyLabel = cnyCents ? formatChargeMoney(cnyCents, "CNY") : "";
  if (chargeLabel && cnyLabel && cur !== "CNY") return `${chargeLabel} (${cnyLabel})`;
  return chargeLabel || cnyLabel;
};

// Generic dual-price label — charge currency primary, reference currency in
// parentheses. Used for GBP-canonical pricing ("€49 (£42)"). Skips the
// reference when it matches the charge currency.
export const formatDualPriceRef = (
  chargeCents: number | null | undefined,
  chargeCurrency: string | null | undefined,
  refCents: number | null | undefined,
  refCurrency: string,
): string => {
  const cur = String(chargeCurrency ?? "").toUpperCase();
  const ref = refCurrency.toUpperCase();
  const chargeLabel = chargeCents && cur ? formatChargeMoney(chargeCents, cur) : "";
  const refLabel = refCents ? formatChargeMoney(refCents, ref) : "";
  if (chargeLabel && refLabel && cur !== ref) return `${chargeLabel} (${refLabel})`;
  return chargeLabel || refLabel;
};
