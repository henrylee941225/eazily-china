// Shared quote-lock helper: converts an ops-entered GBP amount (canonical)
// to the customer's preferred currency at a LIVE mid-market rate, applies
// a configurable markup, rounds to a clean amount, and returns the locked
// charge fields. Throws when the live rate is unavailable — callers must
// surface an ops-facing error, never guess a rate.

// Stripe-supported currencies we ever charge in. All are in the app's
// SUPPORTED_CURRENCIES list. Anything outside this set falls back to GBP.
export const STRIPE_SUPPORTED = new Set([
  "CNY", "USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "HKD",
  "SGD", "NZD", "KRW", "INR", "THB", "MYR", "IDR", "PHP", "MXN",
  "BRL", "ZAR", "SEK", "NOK",
]);

export const ZERO_DECIMAL = new Set(["JPY", "KRW", "IDR"]);

export const DEFAULT_CHARGE_CURRENCY = "GBP";
export const FX_MARKUP = 0.03;
export const CANONICAL_QUOTE_CURRENCY = "GBP";

export type LockedCharge = {
  charge_amount_cents: number;
  charge_currency: string;
  fx_rate_used: number;      // 1 GBP = fx_rate_used charge_currency (post-markup)
  quoted_gbp_cents: number;
  fell_back_to_default: boolean;
};

const fetchLiveRate = async (from: string, to: string): Promise<number> => {
  if (from === to) return 1;
  const url = `https://api.frankfurter.app/latest?amount=1&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`FX provider returned ${res.status}`);
  const data = await res.json();
  const rate = Number(data?.rates?.[to]);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error("Invalid FX response");
  return rate;
};

// Round the human amount (major units, e.g. 54.7823) to a clean value.
// Zero-decimal currencies → nearest whole unit. Others → nearest 0.50.
const roundClean = (amount: number, currency: string): number => {
  if (ZERO_DECIMAL.has(currency)) return Math.round(amount);
  return Math.round(amount * 2) / 2;
};

/**
 * Resolve the target charge currency from a raw preference.
 * Shared by lockCharge and the quote endpoints so they can never diverge.
 */
export const resolveTargetCurrency = (
  preferredCurrencyRaw: string | null | undefined,
): { target: string; fell_back_to_default: boolean } => {
  const pref = String(preferredCurrencyRaw ?? "").toUpperCase();
  const target = STRIPE_SUPPORTED.has(pref) ? pref : DEFAULT_CHARGE_CURRENCY;
  return { target, fell_back_to_default: target !== pref };
};

/**
 * THE shared conversion primitive. Every locked or quoted amount in the app
 * goes through this function — same markup, same rounding, same currency
 * handling. `marked` is the post-markup GBP → target rate (1 for GBP).
 */
export const applyLock = (
  quotedGbpCents: number,
  target: string,
  marked: number,
  fell_back_to_default: boolean,
): LockedCharge => {
  if (target === "GBP") {
    return {
      charge_amount_cents: quotedGbpCents,
      charge_currency: "GBP",
      fx_rate_used: 1,
      quoted_gbp_cents: quotedGbpCents,
      fell_back_to_default,
    };
  }
  const cleanMajor = roundClean((quotedGbpCents / 100) * marked, target);
  const charge_amount_cents = ZERO_DECIMAL.has(target)
    ? Math.round(cleanMajor)
    : Math.round(cleanMajor * 100);
  return {
    charge_amount_cents,
    charge_currency: target,
    fx_rate_used: Number(marked.toFixed(8)),
    quoted_gbp_cents: quotedGbpCents,
    fell_back_to_default,
  };
};

/**
 * Post-markup GBP → target rate. Throws if the live rate is unavailable.
 */
export const markedRateFor = async (target: string): Promise<number> => {
  if (target === "GBP") return 1;
  const midRate = await fetchLiveRate("GBP", target);
  return midRate * (1 + FX_MARKUP);
};

/**
 * Convert an ops-entered GBP amount to the customer's preferred currency,
 * apply markup, round cleanly, and return locked charge fields.
 *
 * GBP customers lock at the GBP amount with no conversion or markup.
 * Throws if the live FX rate is unavailable. Never guesses.
 */
export const lockCharge = async (
  quotedGbpCents: number,
  preferredCurrencyRaw: string | null | undefined,
): Promise<LockedCharge> => {
  const { target, fell_back_to_default } = resolveTargetCurrency(preferredCurrencyRaw);
  const marked = await markedRateFor(target);
  return applyLock(quotedGbpCents, target, marked, fell_back_to_default);
};

/**
 * Batch variant — one rate fetch, N amounts. Identical maths to lockCharge.
 */
export const lockChargeMany = async (
  quotedGbpCentsList: number[],
  preferredCurrencyRaw: string | null | undefined,
): Promise<LockedCharge[]> => {
  const { target, fell_back_to_default } = resolveTargetCurrency(preferredCurrencyRaw);
  const marked = await markedRateFor(target);
  return quotedGbpCentsList.map((c) => applyLock(c, target, marked, fell_back_to_default));
};