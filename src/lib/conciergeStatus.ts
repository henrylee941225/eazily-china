// Single source of truth for concierge task status presentation.
// Kept string-typed so it accepts values from the regenerated Supabase enum
// (which may widen ahead of local unions).

export type ConciergeStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "confirming"
  | "confirmed"
  | "change_pending"
  | "pay_to_confirm"
  | "unavailable"
  | "completed"
  | "cancelled";

export type StatusTone = "pending" | "success" | "error";

// Semantic pairs from Knowledge §2:
//   pending → amber (in progress, awaiting)
//   success → green (confirmed)
//   error   → red (unavailable, cancelled)
export const STATUS_LABEL: Record<ConciergeStatus, string> = {
  pending: "In progress",
  assigned: "In progress",
  in_progress: "In progress",
  confirming: "A person is confirming",
  change_pending: "Change pending",
  pay_to_confirm: "Pay to confirm",
  confirmed: "Confirmed",
  completed: "Confirmed",
  unavailable: "Unavailable",
  cancelled: "Cancelled",
};

export const STATUS_TONE: Record<ConciergeStatus, StatusTone> = {
  pending: "pending",
  assigned: "pending",
  in_progress: "pending",
  confirming: "pending",
  change_pending: "pending",
  pay_to_confirm: "pending",
  confirmed: "success",
  completed: "success",
  unavailable: "error",
  cancelled: "error",
};

// Design-token classes for tinted chips/banners.
export const TONE_CLASSES: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  pending: { bg: "bg-pending-tint", text: "text-pending", dot: "bg-pending" },
  success: { bg: "bg-success-tint", text: "text-success", dot: "bg-success" },
  error: { bg: "bg-error-tint", text: "text-error", dot: "bg-error" },
};

export const isTerminal = (s: ConciergeStatus) =>
  s === "unavailable" || s === "cancelled" || s === "completed";

// "Active" from the requester's perspective — used to decide whether to show
// the composer / cancel button.
export const isActive = (s: ConciergeStatus) =>
  s !== "completed" && s !== "cancelled" && s !== "unavailable";

export const statusLabel = (s: string): string =>
  STATUS_LABEL[s as ConciergeStatus] ?? s.replace(/_/g, " ");

export const statusTone = (s: string): StatusTone =>
  STATUS_TONE[s as ConciergeStatus] ?? "pending";