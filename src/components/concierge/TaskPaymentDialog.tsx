import { useEffect, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { isCapacitorApp } from "@/integrations/capacitor";
import { invokeFn } from "@/lib/invokeFn";
import { getTaskCheckoutReturnUrl } from "@/lib/taskCheckout";

const PUBLISHABLE_KEY = (import.meta as { env?: Record<string, string | undefined> }).env
  ?.VITE_PAYMENTS_CLIENT_TOKEN;

const IS_TEST_KEY = Boolean(PUBLISHABLE_KEY?.startsWith("pk_test_"));

let stripePromise: Promise<Stripe | null> | null = null;
const getStripe = () => {
  if (!stripePromise && PUBLISHABLE_KEY) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  amountLabel: string;
  onPaid?: () => void;
  /** Optional line shown above the checkout, e.g. when an earlier request is still awaiting authorisation. */
  note?: string;
  /** Optional headline replacing the default "Pay {amount}" title. */
  heading?: string;
  /** Optional supporting lines shown under the headline. */
  lines?: string[];
  /** Optional replacement for the default sub-title under the headline. */
  subline?: string;
  /** Optional replacement for the success copy shown after payment. */
  successBody?: string;
  /**
   * Transfer payment model: "hold" = card authorisation captured only once a
   * driver is confirmed; "prepaid" = charged now (pickup > 6 days out) and
   * refunded in full if no car is found. Drives the pre-form explainer and
   * the success screen so the copy never claims a booking is confirmed.
   */
  paymentModel?: "hold" | "prepaid";
};

const SUCCESS_COPY: Record<"hold" | "prepaid", { title: string; body: string; toast: string }> = {
  hold: {
    title: "Payment authorised",
    body: "Your card is on hold — not charged. We're confirming your driver now and will only take payment once your car is booked.",
    toast: "Payment authorised",
  },
  prepaid: {
    title: "Payment received",
    body: "We're confirming your driver now. If we can't find a car, you'll be refunded in full.",
    toast: "Payment received",
  },
};

/**
 * In-app Stripe Embedded Checkout for a concierge task. The publishable key
 * declares the expected mode; the server validates it against the origin.
 */
export const TaskPaymentDialog = ({
  open, onOpenChange, taskId, amountLabel, onPaid, note, heading, lines, subline, successBody, paymentModel,
}: Props) => {
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripeEnv, setStripeEnv] = useState<"sandbox" | "live">("sandbox");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) {
      setClientSecret(null);
      setDone(false);
      setLoading(false);
      return;
    }
    if (!PUBLISHABLE_KEY) {
      toast.error("Payments not configured");
      onOpenChange(false);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await invokeFn<{ client_secret: string; env?: string }>(
          "create-task-checkout",
          {
            task_id: taskId,
            return_url: getTaskCheckoutReturnUrl(taskId, window.location.origin, isCapacitorApp()),
            environment: PUBLISHABLE_KEY?.startsWith("pk_live_") ? "live" : "sandbox",
          },
        );
        if (cancelled) return;
        if (error) {
          console.error("create-task-checkout failed", error);
          toast.error(error.status && error.status < 500 ? error.message : "Couldn't start checkout");
          onOpenChange(false);
          return;
        }
        if (!data?.client_secret) {
          console.error("create-task-checkout returned no client secret");
          toast.error("Couldn't start checkout");
          onOpenChange(false);
          return;
        }
        // Default to live when the server didn't say: the fail-safe direction
        // is "no test-mode copy", never showing test copy to a real customer.
        setStripeEnv(data.env === "sandbox" ? "sandbox" : "live");
        setClientSecret(data.client_secret as string);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          toast.error("Couldn't start checkout");
          onOpenChange(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, taskId, onOpenChange]);

  const options = useMemo(
    () =>
      clientSecret
        ? {
            clientSecret,
            onComplete: () => {
              setDone(true);
              toast.success(paymentModel ? SUCCESS_COPY[paymentModel].toast : "Payment received");
              setTimeout(() => onPaid?.(), 600);
            },
          }
        : undefined,
    [clientSecret, onPaid, paymentModel],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={false}>
      <DialogContent
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        className="flex max-h-[90dvh] max-w-md flex-col gap-0 overflow-hidden rounded-3xl border border-foreground/10 bg-card p-0 shadow-soft"
      >
        <div className="shrink-0 border-b border-border px-5 pb-4 pt-5">
          <DialogHeader className="space-y-1 text-left">
            <DialogTitle className="font-display text-xl text-ink">
              {heading ?? `Pay ${amountLabel}`}
            </DialogTitle>
            <DialogDescription className="text-xs text-ink-secondary">
              {subline ?? "Fixed price agreed with your assistant. Paid securely via Stripe."}
            </DialogDescription>
          </DialogHeader>
          {lines && lines.length > 0 && (
            <ul className="mt-3 space-y-1">
              {lines.map((line) => (
                <li key={line} className="text-[13px] leading-snug text-ink/80">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {note && (
            <p className="mb-3 rounded-2xl bg-tint-warm px-4 py-3 text-[13px] font-medium leading-snug text-ink">
              {note}
            </p>
          )}
          {loading && !clientSecret && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
            </div>
          )}

          {clientSecret && !done && options && (
            <div className="space-y-3">
              {paymentModel && (
                <p className="rounded-2xl bg-surface-2 px-4 py-3 text-[13px] font-medium leading-snug text-ink">
                  {paymentModel === "hold"
                    ? `We'll place a hold for ${amountLabel} now. You're only charged once your driver is confirmed — usually within a few hours.`
                    : `You'll be charged ${amountLabel} now because your pickup is more than 6 days away. Refunded in full if we can't confirm a car.`}
                </p>
              )}
              {/* Two independent signals must both say test money before a
                  customer can ever see test-card copy. */}
              {stripeEnv === "sandbox" && IS_TEST_KEY && (
                <div className="rounded-2xl border border-vermilion/25 bg-vermilion/5 px-3 py-2 text-[11px] leading-snug text-ink/80">
                  <span className="font-medium text-vermilion">Test mode</span>{" · use card "}
                  <span className="font-mono text-ink">4242 4242 4242 4242</span>, any future date, any CVC.
                </div>
              )}
              <div className="overflow-hidden rounded-2xl border border-border bg-white">
                <EmbeddedCheckoutProvider stripe={getStripe()!} options={options}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="mx-auto mt-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-secondary transition hover:text-ink"
              >
                <X className="h-3 w-3" /> Cancel
              </button>
            </div>
          )}

          {done && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success text-white">
                <CheckCircle2 className="h-6 w-6" strokeWidth={2.2} />
              </div>
              <p className="font-display text-lg text-ink">
                {paymentModel ? SUCCESS_COPY[paymentModel].title : "Payment received"}
              </p>
              <p className="max-w-xs text-sm leading-relaxed text-ink-secondary">
                {paymentModel
                  ? SUCCESS_COPY[paymentModel].body
                  : successBody ?? "Your booking is confirmed. Driver details will arrive here shortly."}
              </p>
              <button
                onClick={() => onOpenChange(false)}
                className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-white"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
