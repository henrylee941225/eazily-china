// Presentation layer for the user-facing payment/booking phase of a concierge
// task (transfers in particular).
//
// The phase derivation itself lives in
// supabase/functions/_shared/paymentPhase.ts so edge functions and the frontend
// share one implementation. This module keeps the React-facing presentation map
// (icons, tone classes, copy) and re-exports the shared types/helpers so the
// existing "@/lib/paymentPhase" import path is unchanged.

import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { TONE_CLASSES, type StatusTone } from "@/lib/conciergeStatus";
import { isNotConfirmedInTimeTransfer } from "@/lib/bookingExpiry";
import {
  derivePaymentPhase,
  type PaymentPhase,
  type PhaseInput,
} from "../../supabase/functions/_shared/paymentPhase.ts";

export { derivePaymentPhase };
export type { PaymentPhase, PhaseInput };

export type PhasePresentation = {
  chipLabel: string;
  tone: StatusTone;
  bannerTitle: string;
  bannerIcon: typeof AlertCircle;
  body: string;
};

export const PHASE_PRESENTATION: Record<PaymentPhase, PhasePresentation> = {
  awaiting_payment: {
    chipLabel: "Pay to confirm",
    tone: "pending",
    bannerTitle: "Complete payment to request your driver",
    bannerIcon: AlertCircle,
    body: "Pay below to request your driver — you'll only be charged once your car is confirmed.",
  },
  authorised: {
    chipLabel: "Payment authorised",
    tone: "pending",
    bannerTitle: "Payment authorised — confirming your driver",
    bannerIcon: Loader2,
    body: "Your card is on hold, not charged. You'll only be charged once your driver is confirmed.",
  },
  prepaid: {
    chipLabel: "Payment received",
    tone: "pending",
    bannerTitle: "Payment received — confirming your driver",
    bannerIcon: Loader2,
    body: "Charged now because your trip is further out. Refunded in full if we can't confirm a car.",
  },
  confirmed: {
    chipLabel: "Confirmed",
    tone: "success",
    bannerTitle: "Paid & booked",
    bannerIcon: CheckCircle2,
    body: "Driver details will arrive in the chat before your pickup.",
  },
  unavailable: {
    chipLabel: "Unavailable",
    tone: "error",
    bannerTitle: "We couldn't arrange a car",
    bannerIcon: AlertCircle,
    body: "No cars are free for this pickup. You haven't been charged.",
  },
  cancelled: {
    chipLabel: "Cancelled",
    tone: "error",
    bannerTitle: "Cancelled",
    bannerIcon: AlertCircle,
    body: "This request was cancelled. Nothing further needed.",
  },
  expired: {
    chipLabel: "Expired",
    tone: "pending",
    bannerTitle: "This request expired before payment",
    bannerIcon: AlertCircle,
    body: "Nothing was charged. Request another transfer whenever you're ready.",
  },
  change_pending: {
    chipLabel: "Change pending",
    tone: "pending",
    bannerTitle: "Change being confirmed",
    bannerIcon: RefreshCw,
    body: "We're confirming your change. Your current booking is still held.",
  },
};

/** Greyed-out tone used for stale/expired rows today. */
export const STALE_TONE_CLASSES = {
  bg: "bg-surface-2",
  text: "text-ink-secondary",
  dot: "bg-ink-tertiary",
};

export type ResolvedPhase = PhasePresentation & {
  phase: PaymentPhase;
  toneClasses: { bg: string; text: string; dot: string };
  stale: boolean;
  spin: boolean;
};

/**
 * Full presentation for a task, applying the two existing copy variants that
 * depend on task context (authorised-but-unconfirmed expiry, and the
 * non-transfer wording that exists today).
 */
export const resolvePaymentPresentation = (
  t: PhaseInput,
  opts: { priceLabel?: string } = {},
): ResolvedPhase | null => {
  const phase = derivePaymentPhase(t);
  if (!phase) return null;
  const isTransfer = t.category === "transfer";
  let p = { ...PHASE_PRESENTATION[phase] };

  if (phase === "expired" && isNotConfirmedInTimeTransfer({ ...t, status: "pay_to_confirm" })) {
    p = {
      ...p,
      chipLabel: "Not confirmed",
      bannerTitle: "We couldn't confirm this transfer in time",
      body: "The hold on your card expires automatically — nothing has been charged.",
    };
  }

  if (!isTransfer) {
    if (phase === "confirmed") {
      p = {
        ...p,
        bannerTitle: "Your booking is confirmed",
        body: "Confirmed by the venue. See you there.",
      };
    } else if (phase === "unavailable") {
      p = {
        ...p,
        bannerTitle: "We couldn't book this",
        body: "You haven't been charged — ask the concierge for alternatives.",
      };
    } else if (phase === "awaiting_payment") {
      p = {
        ...p,
        bannerTitle: "Payment required",
        bannerIcon: CheckCircle2,
        body: "Pay below to confirm your booking.",
      };
    }
  } else if (phase === "confirmed" && opts.priceLabel) {
    p = {
      ...p,
      body: `${opts.priceLabel} paid · driver details will arrive in the chat before your pickup.`,
    };
  }

  const stale = phase === "expired";
  return {
    ...p,
    phase,
    stale,
    toneClasses: stale ? STALE_TONE_CLASSES : TONE_CLASSES[p.tone],
    spin: p.bannerIcon === Loader2,
  };
};
