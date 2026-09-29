import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/contexts/CurrencyContext";

/**
 * Converts GBP amounts (the pricing source of truth) into the user's
 * preferred display currency. Stripe still charges in GBP — this only
 * affects what we SHOW in the UI, with an implicit "≈" for non-GBP.
 *
 * We piggyback on the existing fx-check edge function. The CurrencyContext
 * already loads `rate` = "1 selectedCurrency = N CNY". We fetch GBP→CNY
 * here and divide to get GBP → selectedCurrency.
 */
export const useDisplayPrice = () => {
  const { user } = useAuth();
  const { currency, rate: userRate } = useCurrency();
  const [gbpToCny, setGbpToCny] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (currency === "GBP" || !user) {
        setGbpToCny(currency === "GBP" ? 1 : null); // fx-check needs a session
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("fx-check", {
          body: { from: "GBP", to: "CNY", amount: 1 },
        });
        if (cancelled) return;
        if (error || !data || typeof data.rate !== "number") {
          setGbpToCny(null);
        } else {
          setGbpToCny(data.rate);
        }
      } catch {
        if (!cancelled) setGbpToCny(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [currency, user]);

  const meta = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const symbol = meta?.symbol ?? "£";

  const canConvert =
    currency === "GBP" || (gbpToCny !== null && userRate?.rate && userRate.rate > 0);

  const convert = (gbp: number): number => {
    if (currency === "GBP") return gbp;
    if (!canConvert) return gbp;
    const cny = gbp * (gbpToCny as number);
    return cny / (userRate as { rate: number }).rate;
  };

  const format = (gbp: number): string => {
    if (currency === "GBP" || !canConvert) {
      return `£${gbp.toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    const local = convert(gbp);
    const isWhole = currency === "JPY";
    const formatted = local.toLocaleString("en-GB", {
      minimumFractionDigits: isWhole ? 0 : 2,
      maximumFractionDigits: isWhole ? 0 : 2,
    });
    return `${symbol}${formatted}`;
  };

  return {
    currency: currency as CurrencyCode,
    symbol,
    convert,
    format,
    loading,
    isApprox: currency !== "GBP" && canConvert,
    canConvert,
  };
};
