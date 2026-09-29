import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency } from "@/contexts/CurrencyContext";
import { formatChargeMoney } from "@/lib/transfers";

/**
 * Exact transfer pricing in the customer's currency.
 *
 * Calls `quote-transfer` ONCE per screen load with every GBP rate-card
 * amount currently displayed, and returns the exact charge amounts the
 * server will lock at booking (same shared `applyLock` helper, same 3%
 * margin, same rounding). No approximations: while loading callers show
 * skeletons, on failure "Pricing unavailable — retry".
 *
 * GBP customers skip the round-trip — the rate card IS the charge.
 */

const QUOTE_TIMEOUT_MS = 8_000;

export type TransferQuoteState = {
  status: "loading" | "ready" | "error";
  currency: string;
  /** Exact charge label for a GBP rate-card amount, or null if unquoted. */
  labelFor: (gbp: number) => string | null;
  /** Exact charge amount in minor units for a GBP rate-card amount. */
  centsFor: (gbp: number) => number | null;
  retry: () => void;
};

export const useTransferQuote = (
  gbpAmounts: (number | null | undefined)[],
  /** Bump to force a fresh quote (e.g. landing on the confirm step). */
  refreshKey: unknown = 0,
): TransferQuoteState => {
  const { session } = useAuth();
  const { currency } = useCurrency();

  // Stable, de-duplicated, sorted list so the effect doesn't re-fire on
  // every render just because a new array identity was passed in.
  const key = useMemo(() => {
    const set = new Set<number>();
    for (const a of gbpAmounts) {
      if (typeof a === "number" && Number.isFinite(a) && a > 0) set.add(Math.round(a));
    }
    return Array.from(set).sort((a, b) => a - b).join(",");
  }, [gbpAmounts]);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [attempt, setAttempt] = useState(0);
  const [map, setMap] = useState<Record<number, number>>({});
  const [quoteCurrency, setQuoteCurrency] = useState<string>(currency);
  const mapRef = useRef(map);
  mapRef.current = map;

  useEffect(() => {
    let cancelled = false;
    const amounts = key ? key.split(",").map(Number) : [];
    if (amounts.length === 0) {
      setStatus("ready");
      return;
    }
    if (!session || currency === "GBP") {
      // Rate card is already the charge currency — nothing to convert.
      setQuoteCurrency("GBP");
      setMap(Object.fromEntries(amounts.map((g) => [g, g * 100])));
      setStatus("ready");
      return;
    }
    setStatus("loading");
    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, QUOTE_TIMEOUT_MS);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("quote-transfer", {
          body: { gbp_cents: amounts.map((g) => g * 100) },
        });
        if (cancelled) return;
        window.clearTimeout(timeout);
        const quotes = (data as { quotes?: { quoted_gbp_cents: number; charge_amount_cents: number }[] } | null)?.quotes;
        if (error || !Array.isArray(quotes)) {
          setStatus("error");
          return;
        }
        const next: Record<number, number> = {};
        for (const q of quotes) {
          next[Math.round(Number(q.quoted_gbp_cents) / 100)] = Number(q.charge_amount_cents);
        }
        setMap(next);
        setQuoteCurrency(String((data as { charge_currency?: string }).charge_currency ?? currency));
        setStatus("ready");
      } catch (e) {
        if (cancelled) return;
        window.clearTimeout(timeout);
        console.error("transfer quote failed", e);
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [key, session, currency, attempt, refreshKey]);

  const centsFor = useCallback(
    (gbp: number) => {
      const cents = mapRef.current[Math.round(gbp)];
      return typeof cents === "number" ? cents : null;
    },
    [map],
  );

  const labelFor = useCallback(
    (gbp: number) => {
      const cents = centsFor(gbp);
      return cents == null ? null : formatChargeMoney(cents, quoteCurrency);
    },
    [centsFor, quoteCurrency],
  );

  return {
    status,
    currency: quoteCurrency,
    labelFor,
    centsFor,
    retry: () => setAttempt((n) => n + 1),
  };
};