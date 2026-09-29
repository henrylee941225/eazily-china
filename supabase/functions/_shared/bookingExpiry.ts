// Client-side expiry classification for concierge tasks.
//
// Two distinct past-pickup end states exist for transfers still parked in
// `pay_to_confirm`, and the UI must not conflate them:
//
//   - "unpaid_expired"  — never authorised. The traveller never paid; the
//                          request lapsed. Server cron cancels these.
//   - "not_confirmed"   — authorised but never captured. Card was held, no
//                          driver was confirmed in time; the Stripe hold
//                          releases automatically when the auth window ends.
//
// Both should be hidden from Home and land in Bookings → Past, but with
// different chip labels and banner copy. Presentation-only — the underlying
// task row is unchanged until an ops action or a webhook flips it.

export type ExpiryInput = {
  status: string;
  category: string;
  paid_at: string | null;
  authorized_at: string | null;
  details_json: unknown;
};

const pickupMs = (details_json: unknown): number => {
  if (!details_json || typeof details_json !== "object") return NaN;
  const p = (details_json as { pickup_at?: unknown }).pickup_at;
  if (typeof p !== "string" || !p) return NaN;
  const ms = Date.parse(p);
  return Number.isFinite(ms) ? ms : NaN;
};

const HOUR_MS = 60 * 60 * 1000;

const isTransferPayToConfirm = (row: ExpiryInput): boolean =>
  row.category === "transfer" && row.status === "pay_to_confirm" && !row.paid_at;

/** Never-authorised transfer whose pickup is in the past. */
export const isExpiredUnpaidTransfer = (row: ExpiryInput): boolean => {
  if (!isTransferPayToConfirm(row)) return false;
  if (row.authorized_at) return false;
  const ms = pickupMs(row.details_json);
  if (!Number.isFinite(ms)) return false;
  return ms < Date.now();
};

/** Authorised but never confirmed — pickup is >1h in the past. Stripe hold
 *  releases automatically; nothing has been charged. */
export const isNotConfirmedInTimeTransfer = (row: ExpiryInput): boolean => {
  if (!isTransferPayToConfirm(row)) return false;
  if (!row.authorized_at) return false;
  const ms = pickupMs(row.details_json);
  if (!Number.isFinite(ms)) return false;
  return ms < Date.now() - HOUR_MS;
};

/** Combined check — either past-pickup stale state. Use to exclude from
 *  Home / active lists. */
export const isTransferPastPickupStale = (row: ExpiryInput): boolean =>
  isExpiredUnpaidTransfer(row) || isNotConfirmedInTimeTransfer(row);