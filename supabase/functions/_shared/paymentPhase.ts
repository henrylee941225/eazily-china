// Single source of truth for the payment/booking phase of a concierge task.
// Pure logic only — no React, no icons — so both the frontend
// (src/lib/paymentPhase.ts re-exports this) and edge functions import one file.
//
// The DB enum `concierge_task_status` collapses three real-world payment
// situations into `pay_to_confirm`:
//   - nothing paid                        -> awaiting_payment
//   - card authorised (hold, not charged) -> authorised
//   - card charged on automatic capture   -> prepaid
// distinguished only by paid_at / authorized_at / hold_released_at.

import {
  isExpiredUnpaidTransfer,
  isNotConfirmedInTimeTransfer,
} from "./bookingExpiry.ts";

export type PaymentPhase =
  | "awaiting_payment"
  | "authorised"
  | "prepaid"
  | "confirmed"
  | "unavailable"
  | "cancelled"
  | "expired"
  | "change_pending";

export type PhaseInput = {
  status: string;
  category: string;
  paid_at: string | null;
  authorized_at: string | null;
  hold_released_at?: string | null;
  details_json: unknown;
};

/**
 * Derive the payment phase. Returns null for statuses that are not part of the
 * payment lifecycle (pending / assigned / in_progress / confirming), so
 * non-transfer concierge categories keep their existing conciergeStatus.ts
 * labels untouched.
 */
export const derivePaymentPhase = (t: PhaseInput): PaymentPhase | null => {
  const s = t.status;
  if (s === "confirmed" || s === "completed") return "confirmed";
  if (s === "unavailable") return "unavailable";
  if (s === "cancelled") {
    return isExpiredUnpaidTransfer({ ...t, status: "pay_to_confirm" }) ||
      isNotConfirmedInTimeTransfer({ ...t, status: "pay_to_confirm" })
      ? "expired"
      : "cancelled";
  }
  if (s === "change_pending") return "change_pending";
  if (s === "pay_to_confirm") {
    // Past-pickup stale holds read as expired everywhere.
    if (isExpiredUnpaidTransfer(t) || isNotConfirmedInTimeTransfer(t)) return "expired";
    if (t.paid_at) return "prepaid";
    if (t.authorized_at && !t.hold_released_at) return "authorised";
    return "awaiting_payment";
  }
  return null;
};

/** Ops-only statuses that never produce a customer notification. */
export const OPS_ONLY_STATUSES = ["pending", "assigned", "in_progress", "confirming"];
