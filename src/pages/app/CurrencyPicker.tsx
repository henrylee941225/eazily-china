import { useNavigate } from "react-router-dom";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/contexts/CurrencyContext";
import { triggerHaptic } from "@/integrations/median";

/**
 * Currency picker over the fx-lock-supported set. Writes
 * profiles.preferred_currency via CurrencyContext.setCurrency (same code
 * path as EditProfile's Home currency field). Applies to future quotes
 * only — existing bookings keep their locked currency.
 */
const CurrencyPicker = () => {
  const navigate = useNavigate();
  const { currency, setCurrency } = useCurrency();

  const choose = async (c: CurrencyCode) => {
    if (c === currency) {
      navigate("/account");
      return;
    }
    await setCurrency(c);
    triggerHaptic("impactLight");
    toast.success("Currency updated");
    navigate("/account");
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header
        className="sticky top-0 z-40 border-b border-border bg-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-[440px] items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/account")}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-[20px] font-bold text-ink">Currency</h1>
        </div>
      </header>

      <main className="mx-auto max-w-[440px] px-5 pt-4">
        <p className="text-[13px] leading-snug text-ink-secondary">
          Booking charges, transfer quotes and prices appear in this currency.
        </p>
        <p className="mt-1 text-[12px] leading-snug text-ink-tertiary">
          Applies to new bookings and purchases. Existing bookings keep the currency they were confirmed in.
        </p>

        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-white">
          {SUPPORTED_CURRENCIES.map((c) => {
            const selected = c.code === currency;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => choose(c.code)}
                  className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition active:bg-surface-2"
                >
                  <span className="text-[20px]" aria-hidden>{c.flag}</span>
                  <span className="flex-1 text-[15px] text-ink">
                    <span className="font-medium">{c.label}</span>
                    <span className="text-ink-secondary"> · {c.code} {c.symbol}</span>
                  </span>
                  {selected && (
                    <Check className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={2.5} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
};

export default CurrencyPicker;