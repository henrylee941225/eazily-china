import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";

/**
 * Formats a GBP canonical price for indicative display in the customer's
 * preferred currency. Rate unavailable or signed-out users see the plain
 * £ price. Signed-in GBP users also see the plain £ price (no conversion).
 * Signed-in non-GBP users see "≈ €49 · indicative" with GBP as secondary.
 */
export const useIndicativePrice = () => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [gbpToTarget, setGbpToTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const showGbpOnly = !user || currency === "GBP";

  useEffect(() => {
    let cancelled = false;
    if (showGbpOnly) {
      setGbpToTarget(null);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("fx-check", { body: { from: "GBP", to: currency, amount: 1 } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data || typeof (data as { rate?: number }).rate !== "number") {
          setGbpToTarget(null);
        } else {
          setGbpToTarget((data as { rate: number }).rate);
        }
      })
      .catch(() => {
        if (!cancelled) setGbpToTarget(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currency, showGbpOnly]);

  const symbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? "£";
  const isZeroDecimal = currency === "JPY" || currency === "KRW" || currency === "IDR";

  const gbpLabel = (gbp: number): string => `£${gbp.toLocaleString("en-GB")}`;

  /** Returns primary/secondary labels for the given GBP amount. */
  const format = (
    gbp: number,
  ): { primary: string; secondary: string | null; approx: boolean } => {
    if (showGbpOnly || gbpToTarget == null) {
      return { primary: gbpLabel(gbp), secondary: null, approx: false };
    }
    const local = gbp * gbpToTarget;
    // Rounded to whole units for indicative display — cheap and legible.
    const rounded = isZeroDecimal ? Math.round(local) : Math.round(local);
    const formatted = rounded.toLocaleString("en-GB");
    return {
      primary: `≈ ${symbol}${formatted}`,
      secondary: null,
      approx: true,
    };
  };

  return { format, loading, showGbpOnly, gbpLabel };
};