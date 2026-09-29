import { useState } from "react";
import { Lock, Pencil, XCircle, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatChargeMoney } from "@/lib/transfers";
import { isActive, type ConciergeStatus } from "@/lib/conciergeStatus";
import { TaskPaymentDialog } from "@/components/concierge/TaskPaymentDialog";
import { TransferChangeDialog } from "@/components/concierge/TransferChangeDialog";
import {
  CANCELLATION_CLOSED_LINE,
  FREE_CANCELLATION_POLICY_LINE,
  formatFreeCancellationUntil,
  isCancellationWindowClosed,
} from "@/lib/transferCancellation";
import { cancelTaskWithPolicy } from "@/lib/cancelTask";
import { BOOKING_MESSAGES_ANCHOR, FOCUS_BOOKING_COMPOSER_EVENT } from "@/components/concierge/TransferMessages";

// Minimal shape shared by BookingDetail. Kept intentionally narrow so callers
// don't have to widen their own Task type.
export type TransferActionsTask = {
  id: string;
  status: ConciergeStatus;
  category: string;
  price_cents: number;
  currency: string;
  paid_at: string | null;
  charge_amount_cents: number | null;
  charge_currency: string | null;
  quoted_gbp_cents: number | null;
  amount_paid_cents: number | null;
  authorized_at: string | null;
  capture_method: string | null;
  user_id: string;
  details_json?: unknown;
};

const usePricingLabels = (task: TransferActionsTask) => {
  const chargeCents = task.charge_amount_cents ?? 0;
  const chargeCurrency = task.charge_currency ?? task.currency ?? "";
  const chargeLabel = chargeCents > 0 ? formatChargeMoney(chargeCents, chargeCurrency) : "";
  return { chargeCents, chargeLabel };
};

/**
 * Payment card for a transfer: renders the fixed-price quote plus the
 * appropriate action state — Pay CTA when unpaid, "Authorised …" chip while
 * held, "Paid …" chip once captured. Silent when the task is outside the
 * pay lifecycle. Owner-only.
 */
export const TransferPayCard = ({
  task,
  isOwner,
}: {
  task: TransferActionsTask;
  isOwner: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const isTransfer = task.category === "transfer";
  const { chargeCents, chargeLabel } = usePricingLabels(task);
  if (!isTransfer || !isOwner) return null;
  // Only render in the unpaid lifecycle. Once authorised or paid, the banner
  // and trip-card paid chip carry the state — the pay card would duplicate it.
  const unpaid =
    task.status === "pay_to_confirm" && !task.paid_at && !task.authorized_at;
  if (!unpaid || !chargeLabel) return null;
  const canPay =
    chargeCents > 0;
  const isManualCapture = task.capture_method === "manual";

  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
        Quote confirmed · {chargeLabel} · fixed price
      </p>
      <p className="mt-1 text-[12px] leading-snug text-ink-secondary">
        {isManualCapture && !task.paid_at
          ? "You'll only be charged once your driver is confirmed. Pay securely in the app — Apple Pay, Google Pay and cards."
          : "Tolls and airport fees included. Pay securely in the app — Apple Pay, Google Pay and cards."}
      </p>
      <p className="mt-1 text-[12px] leading-snug text-ink-secondary">
        {FREE_CANCELLATION_POLICY_LINE}
      </p>
      {canPay && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-[14px] font-semibold text-white transition hover:bg-ink/90"
        >
          <Lock className="h-4 w-4" strokeWidth={2} />
          Pay {chargeLabel} &amp; confirm
        </button>
      )}

      {canPay && (
        <TaskPaymentDialog
          open={open}
          onOpenChange={setOpen}
          taskId={task.id}
          amountLabel={chargeLabel}
          paymentModel={isManualCapture ? "hold" : "prepaid"}
        />
      )}
    </div>
  );
};

/**
 * "Request a change" button + dialog for an active transfer. Owner-only and
 * hidden once a change is already pending or the task is inactive.
 */
export const TransferChangeButton = ({
  task,
  isOwner,
}: {
  task: TransferActionsTask;
  isOwner: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const isTransfer = task.category === "transfer";
  const canRequestChange =
    isTransfer &&
    isOwner &&
    isActive(task.status) &&
    task.status !== "change_pending";
  if (!canRequestChange) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:bg-surface-2"
      >
        <Pencil className="h-3.5 w-3.5" strokeWidth={2} />
        Request a change
      </button>
      <TransferChangeDialog open={open} onOpenChange={setOpen} taskId={task.id} />
    </>
  );
};

/**
 * Cancellation row for a CONFIRMED transfer. Free cancellation is available
 * until 24 hours before pickup; inside that window the action is replaced by
 * a disabled state plus a route to the concierge. Owner-only.
 */
/**
 * Scrolls to the booking's own Messages section and focuses its composer.
 * Deliberately NOT /concierge/chat — that surface is Trip Pass-gated and a
 * passless customer must still be able to discuss a booking they've paid for.
 */
const openBookingComposer = () => {
  const el = document.getElementById(BOOKING_MESSAGES_ANCHOR);
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => window.dispatchEvent(new Event(FOCUS_BOOKING_COMPOSER_EVENT)), 350);
};

export const TransferCancelSection = ({
  task,
  isOwner,
}: {
  task: TransferActionsTask;
  isOwner: boolean;
}) => {
  const [busy, setBusy] = useState(false);
  if (task.category !== "transfer" || !isOwner) return null;

  // Unconfirmed but money already committed: authorised hold or prepaid
  // charge, no driver yet. The customer needs a way out here too.
  const unconfirmedCommitted =
    task.status !== "confirmed" &&
    isActive(task.status) &&
    (task.authorized_at != null || task.paid_at != null);
  if (task.status !== "confirmed" && !unconfirmedCommitted) return null;

  const closed = isCancellationWindowClosed({
    status: task.status,
    category: task.category,
    details_json: task.details_json,
  });
  const untilLine = formatFreeCancellationUntil(task.details_json);

  if (closed) {
    return (
      <div className="rounded-2xl border border-border bg-surface-2 p-4">
        <p className="text-[13px] leading-snug text-ink-secondary">{CANCELLATION_CLOSED_LINE}</p>
        <button
          type="button"
          onClick={openBookingComposer}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-2.5 text-[13px] font-semibold text-ink transition hover:bg-surface-3"
        >
          <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
          Message the concierge
        </button>
      </div>
    );
  }

  // What cancelling means, in the customer's terms, split by payment model.
  const cancelCopy = unconfirmedCommitted
    ? task.paid_at != null
      ? "Cancel this request — you'll be refunded in full. Refunds take 5–10 working days."
      : "Cancel this request — the hold on your card is released and nothing is charged."
    : null;

  const onCancel = async () => {
    if (busy) return;
    if (!confirm("Cancel this transfer? This can't be undone.")) return;
    setBusy(true);
    const result = await cancelTaskWithPolicy(task.id);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.message ?? "Couldn't cancel. Try again.");
      return;
    }
    toast.success("Transfer cancelled");
  };

  return (
    <div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-red/60 bg-white px-4 py-2.5 text-[13px] font-semibold text-brand-red transition hover:bg-error-tint/40 disabled:opacity-40"
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        {unconfirmedCommitted ? "Cancel this request" : "Cancel transfer"}
      </button>
      {cancelCopy ? (
        <p className="mt-2 text-center text-[12px] leading-snug text-ink-secondary">{cancelCopy}</p>
      ) : (
        untilLine && (
          <p className="mt-2 text-center text-[12px] leading-snug text-ink-secondary">{untilLine}</p>
        )
      )}
    </div>
  );
};