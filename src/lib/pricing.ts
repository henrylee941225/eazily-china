/**
 * Trip Pass v2 — flat GBP price for the whole trip.
 *
 * One price, one purchase. Valid through trip_end_date, capped at 60 days.
 * The authoritative source of truth is the create-pass-checkout edge
 * function; this file exists only so the UI can render a matching label
 * without a network call. Do NOT show any per-day rate in the UI.
 */

export const TRIP_PASS = {
  /** Maximum days a single pass can cover. Longer trips need a second pass. */
  maxTripDays: 60,
  /** Legacy alias kept for callers still expecting the old field name. */
  maxBillableDays: 60,
  priceGbp: 9.99,
  currency: "GBP" as const,
  currencySymbol: "£",
  /** Stripe price id (placeholder — checkout uses dynamic price_data). */
  stripePriceId: "trip_pass_flat_gbp" as const,
};

/**
 * Flat price regardless of days. Kept as a function so existing call sites
 * that pass a day count don't break.
 */
export const calculatePrice = (_days?: number): number => TRIP_PASS.priceGbp;

/** Inclusive day count between two ISO dates (YYYY-MM-DD). */
export const tripDaysBetween = (
  arrivalIso?: string | null,
  departureIso?: string | null,
): number => {
  if (!arrivalIso) return 0;
  const arrival = new Date(`${arrivalIso}T00:00:00Z`);
  if (Number.isNaN(arrival.getTime())) return 0;
  const departure = departureIso ? new Date(`${departureIso}T00:00:00Z`) : arrival;
  if (Number.isNaN(departure.getTime())) return 1;
  const diffMs = departure.getTime() - arrival.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
  return Math.max(1, days);
};

export type TripPassQuote = {
  tripDays: number;
  billableDays: number;
  freeDays: number;
  totalPrice: number;
  capReached: boolean;
  currency: string;
  currencySymbol: string;
  estimatedFeeSavings: number;
};

export const quoteTripPass = (
  arrivalIso?: string | null,
  departureIso?: string | null,
  fallbackDays = 7,
): TripPassQuote => {
  const tripDays = tripDaysBetween(arrivalIso, departureIso) || fallbackDays;
  return quoteForDays(tripDays);
};

export const quoteForDays = (tripDays: number): TripPassQuote => {
  const safeDays = Math.max(1, Math.round(tripDays));
  const cappedDays = Math.min(safeDays, TRIP_PASS.maxTripDays);
  const freeDays = Math.max(0, safeDays - TRIP_PASS.maxTripDays);
  return {
    tripDays: safeDays,
    billableDays: cappedDays,
    freeDays,
    totalPrice: TRIP_PASS.priceGbp,
    capReached: safeDays > TRIP_PASS.maxTripDays,
    currency: TRIP_PASS.currency,
    currencySymbol: TRIP_PASS.currencySymbol,
    estimatedFeeSavings: 0,
  };
};

export const formatPrice = (amount: number, symbol = TRIP_PASS.currencySymbol) =>
  `${symbol}${amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

/** Format a YYYY-MM-DD as e.g. "Apr 27". */
export const formatTripDate = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
};

export const formatTripDateLong = (iso?: string | null): string => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
};

/**
 * Calendar-day arithmetic in the viewer's local timezone. Both inputs are
 * YYYY-MM-DD strings (as stored on trip_passes / profiles). Returns the
 * whole number of calendar days from `fromIso` to `toIso` (negative if
 * `toIso` is earlier). One day = one date-part change at local midnight.
 */
const localMidnight = (iso: string): Date | null => {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return null;
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

export const calendarDaysBetween = (fromIso: string, toIso: string): number => {
  const a = localMidnight(fromIso);
  const b = localMidnight(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
};

const todayLocalIso = (): string => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

/**
 * State-aware label for an active pass, using calendar-day arithmetic in
 * the viewer's local timezone against the PASS's covered dates (never the
 * stored active_until timestamp, which can be end-of-day exclusive).
 *
 * - before trip: "Your trip starts in {n} days"
 * - during trip: "{n} days of your trip remaining" (n = days until end, inclusive)
 * - after trip:  "Trip complete"
 */
export const tripStateLabel = (
  startIso?: string | null,
  endIso?: string | null,
): string => {
  if (!startIso || !endIso) return "";
  const today = todayLocalIso();
  const toStart = calendarDaysBetween(today, startIso);
  const toEnd = calendarDaysBetween(today, endIso);
  if (toStart > 0) {
    return `Your trip starts in ${toStart} ${toStart === 1 ? "day" : "days"}`;
  }
  if (toEnd >= 0) {
    const n = toEnd + 1; // inclusive of today
    return `${n} ${n === 1 ? "day" : "days"} of your trip remaining`;
  }
  return "Trip complete";
};
