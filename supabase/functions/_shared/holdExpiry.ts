// Authorisation-hold lifecycle constants, shared by the hourly sweeper and the
// capture path in concierge-update-task.
//
// Stripe auto-cancels an uncaptured PaymentIntent after roughly 7 days. We act
// before that so we control the message rather than discovering a failed
// capture:
// Thresholds come from HOLD_WARN_AFTER_HOURS / HOLD_RELEASE_AFTER_HOURS, read
// at invocation (defaults 120h and 156h):
//   +5 days     -> ops alert ("at risk") + customer hold_expiring_soon
//   +6d 12h     -> we cancel the PaymentIntent ourselves and mark the booking
//                  unavailable, 12 hours ahead of Stripe's own lapse.

export const HOUR_MS = 60 * 60 * 1000;

const envHours = (name: string, fallback: number): number => {
  const raw = Deno.env.get(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.warn(`holdExpiry: ignoring invalid ${name}="${raw}", using ${fallback}`);
    return fallback;
  }
  return n;
};

/** Ops warning / customer heads-up threshold, read at invocation. */
export const holdAtRiskHours = (): number => envHours("HOLD_WARN_AFTER_HOURS", 120);
/** Proactive release threshold, read at invocation. */
export const holdReleaseHours = (): number => envHours("HOLD_RELEASE_AFTER_HOURS", 156);

/** Log the thresholds actually in force for this invocation. */
export const logHoldThresholds = (context: string): { atRiskHours: number; releaseHours: number } => {
  const atRiskHours = holdAtRiskHours();
  const releaseHours = holdReleaseHours();
  console.log(
    `${context}: effective hold thresholds — HOLD_WARN_AFTER_HOURS=${atRiskHours}h, HOLD_RELEASE_AFTER_HOURS=${releaseHours}h`,
  );
  return { atRiskHours, releaseHours };
};

export const holdAgeHours = (authorizedAt: string | null | undefined): number | null => {
  if (!authorizedAt) return null;
  const ms = Date.parse(authorizedAt);
  if (!Number.isFinite(ms)) return null;
  return (Date.now() - ms) / HOUR_MS;
};

/** True once the hold is past the point where we still attempt a capture. */
export const isAuthorisationExpired = (authorizedAt: string | null | undefined): boolean => {
  const age = holdAgeHours(authorizedAt);
  return age !== null && age >= holdReleaseHours();
};

/** Whole hours left before we release the hold ourselves (never negative). */
export const hoursUntilRelease = (authorizedAt: string | null | undefined): number => {
  const age = holdAgeHours(authorizedAt);
  if (age === null) return 0;
  return Math.max(0, Math.round(holdReleaseHours() - age));
};
