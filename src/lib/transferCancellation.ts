// Transfer cancellation policy (client mirror of the server rule in
// concierge-update-task):
//
//   - UNCONFIRMED transfers (pay_to_confirm — unpaid, authorised or charged):
//     cancellable at any time.
//   - CONFIRMED transfers: free cancellation only until 24 hours before
//     pickup. At or inside 24h, in-app cancellation is not available.
//   - Malformed / missing pickup_at never strands the customer — cancellation
//     stays available.
//
// Presentation helper only: the server is authoritative.

export const CANCELLATION_WINDOW_MS = 24 * 60 * 60 * 1000;

export const FREE_CANCELLATION_POLICY_LINE =
  "Free cancellation until 24 hours before pickup.";

export const CANCELLATION_CLOSED_LINE =
  "Free cancellation has closed (24 hours before pickup).";

export type CancellationInput = {
  status: string;
  category: string;
  details_json: unknown;
};

const pickupMs = (details_json: unknown): number => {
  if (!details_json || typeof details_json !== "object") return NaN;
  const p = (details_json as { pickup_at?: unknown }).pickup_at;
  if (typeof p !== "string" || !p) return NaN;
  const ms = Date.parse(p);
  return Number.isFinite(ms) ? ms : NaN;
};

/** Deadline (ms epoch) for free cancellation, or null when unknown. */
export const freeCancellationDeadline = (details_json: unknown): number | null => {
  const ms = pickupMs(details_json);
  return Number.isFinite(ms) ? ms - CANCELLATION_WINDOW_MS : null;
};

const isConfirmedTransfer = (row: CancellationInput): boolean =>
  row.category === "transfer" && row.status === "confirmed";

/** True when the 24h free-cancellation window has closed for this task. */
export const isCancellationWindowClosed = (row: CancellationInput): boolean => {
  if (!isConfirmedTransfer(row)) return false;
  const deadline = freeCancellationDeadline(row.details_json);
  if (deadline === null) return false; // malformed pickup — never strand
  return Date.now() >= deadline;
};

/** "Free cancellation until Fri 12 Sep, 14:30" — null when unknown. */
export const formatFreeCancellationUntil = (details_json: unknown): string | null => {
  const deadline = freeCancellationDeadline(details_json);
  if (deadline === null) return null;
  const d = new Date(deadline);
  const date = d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `Free cancellation until ${date}, ${time}`;
};
