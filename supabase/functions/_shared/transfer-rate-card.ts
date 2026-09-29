// Server-side authoritative rate card. Mirrors src/lib/transfers.ts so the
// create-task function can compute the locked GBP charge from details_json
// alone, rather than trusting a client-supplied amount. Placeholder values —
// keep in sync with the frontend card until real prices are wired in.

export type CarClass = "standard" | "premium" | "van" | "first" | "maybach";
export type TransferService = "airport" | "hourly" | "station";

// Airport rate card keyed by IATA code. SHA (Hongqiao Airport) shares its
// price row with Hongqiao Railway Station.
export const AIRPORT_RATE_CARD_GBP: Record<string, Record<CarClass, number>> = {
  SHA: { standard: 29, premium: 58, van: 72, first: 101, maybach: 173 },
  PVG: { standard: 38, premium: 72, van: 87, first: 115, maybach: 216 },
};

// Only Hongqiao Railway is priced today.
export const STATION_RATE_CARD_GBP: Record<string, Record<CarClass, number>> = {
  hongqiao: { standard: 29, premium: 58, van: 72, first: 101, maybach: 173 },
};

// Hourly rate card — `maybach` is null on the 4-hour block (not bookable).
export const HOURLY_RATE_CARD_GBP: Record<number, Record<CarClass, number | null>> = {
  4:  { standard: 72,  premium: 87,  van: 87,  first: 130, maybach: null },
  8:  { standard: 101, premium: 130, van: 144, first: 216, maybach: 360 },
  10: { standard: 115, premium: 173, van: 173, first: 259, maybach: 403 },
};

export const computeTransferGbp = (
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