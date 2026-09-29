import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, ChevronDown, AlertCircle, Tag, ShieldAlert, Check } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";

type CurrencyCode = "USD" | "EUR" | "GBP" | "JPY" | "AUD" | "CAD" | "HKD" | "SGD";

const CURRENCIES: { code: CurrencyCode; label: string; symbol: string; flag: string }[] = [
  { code: "USD", label: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", label: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", label: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", label: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "HKD", label: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "SGD", label: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
];

const QUICK_AMOUNTS = [10, 20, 50, 100];

const TIPS = [
  {
    icon: AlertCircle,
    title: "Watch small surcharges",
    body: "For transactions over ¥200, ask to split the bill into smaller charges and avoid the ~3% card fee.",
  },
  {
    icon: Tag,
    title: "Know when to haggle",
    body: "Shops and restaurants are fixed price. At markets, bargain. Start at half and meet in the middle.",
  },
  {
    icon: ShieldAlert,
    title: "Spot the scams",
    body: "Only scan official merchant codes on screens or stands, never loose paper or unverified QRs.",
  },
];

const cleanNumeric = (v: string) =>
  v.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");

const formatAmount = (n: number, dp = 2) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });

const timeAgo = (ms: number) => {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 45) return "just now";
  if (s < 90) return "1 min ago";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return `${Math.round(s / 3600)} h ago`;
};

const Exchange = () => {
  const [from, setFrom] = useState<CurrencyCode>("USD");
  const [haveStr, setHaveStr] = useState("100");
  const [getStr, setGetStr] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateFetchedAt, setRateFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [now, setNow] = useState(Date.now());
  // false = From → CNY (default); true = CNY → From
  const [reversed, setReversed] = useState(false);
  const [swapSpin, setSwapSpin] = useState(0);

  // Track which side the user is editing so the other side follows.
  const leadRef = useRef<"have" | "get">("have");

  // Refresh "updated N min ago" every 30s.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Fetch rate whenever the source currency changes.
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fnError } = await supabase.functions.invoke("fx-check", {
          body: { from, to: "CNY", amount: 1 },
        });
        if (cancelled) return;
        if (fnError || !data || typeof data.rate !== "number") {
          setError("Couldn't fetch live rate");
          setRate(null);
          return;
        }
        setRate(data.rate);
        setRateFetchedAt(Date.now());
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError("Couldn't fetch live rate");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [from]);

  // Re-derive the follower field whenever rate or the lead value changes.
  useEffect(() => {
    if (rate == null) return;
    // Conversion factor applied to the "have" value to produce "get".
    // Non-reversed: have=from → get=CNY, factor = rate.
    // Reversed:     have=CNY  → get=from, factor = 1/rate.
    const haveToGet = reversed ? 1 / rate : rate;
    if (leadRef.current === "have") {
      const n = Number(haveStr);
      setGetStr(Number.isFinite(n) && haveStr !== "" ? formatAmount(n * haveToGet) : "");
    } else {
      const n = Number(getStr);
      setHaveStr(Number.isFinite(n) && getStr !== "" ? formatAmount(n / haveToGet, 2) : "");
    }
    // Only react to rate changes and edits to the lead field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, reversed, leadRef.current === "have" ? haveStr : getStr]);

  const onHaveChange = (v: string) => {
    leadRef.current = "have";
    setHaveStr(cleanNumeric(v));
  };
  const onGetChange = (v: string) => {
    leadRef.current = "get";
    setGetStr(cleanNumeric(v));
  };

  const swap = () => {
    // Swap direction: what was in the bottom card moves to the top and
    // becomes the new source amount. The other side is recomputed via fx.
    const nextReversed = !reversed;
    const currentBottom = getStr; // visually the "You get" value
    leadRef.current = "have";
    setReversed(nextReversed);
    setHaveStr(currentBottom && currentBottom !== "" ? cleanNumeric(currentBottom) : haveStr);
    setSwapSpin((s) => s + 1);
  };

  const pickQuick = (amt: number) => {
    leadRef.current = "have";
    setHaveStr(String(amt));
  };

  const selected = useMemo(() => CURRENCIES.find((c) => c.code === from)!, [from]);
  const displayRate = rate ? formatAmount(rate, 2) : "—";

  // Which currency shows on top vs bottom depends on direction.
  const topCode = reversed ? "CNY" : from;
  const topSymbol = reversed ? "¥" : selected.symbol;
  const bottomCode = reversed ? from : "CNY";
  const bottomSymbol = reversed ? selected.symbol : "¥";

  return (
    <AppLayout
      title="Exchange"
      showBack
      backTo="/"
      headerRight={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-success-tint px-3 py-1 text-[12px] font-semibold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Live
        </span>
      }
    >
      <div className="mx-auto w-full max-w-[440px] space-y-6">
        {/* Converter */}
        <div className="relative">
          {/* YOU HAVE */}
          <div className="rounded-2xl bg-surface-2 p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
                You have
              </span>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                disabled={reversed}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[14px] font-semibold text-ink"
                aria-label="Change currency"
              >
                {topCode} {topSymbol}
                {!reversed && <ChevronDown className="h-4 w-4 text-brand-red" strokeWidth={2.2} />}
              </button>
            </div>
            <input
              inputMode="decimal"
              value={haveStr}
              onChange={(e) => onHaveChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              aria-label={`Amount in ${topCode}`}
              className="mt-3 w-full bg-transparent text-[40px] font-extrabold leading-none text-ink outline-none placeholder:text-ink-tertiary"
            />
          </div>

          {/* Swap */}
          <button
            type="button"
            onClick={swap}
            aria-label="Swap direction"
            style={{ transform: `translate(-50%, -50%) rotate(${swapSpin * 180}deg)` }}
            className="absolute left-1/2 top-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white ring-4 ring-white transition-transform duration-300 ease-out active:scale-95 focus:outline-none focus-visible:ring-4 focus-visible:ring-white focus-visible:shadow-[0_0_0_2px_hsl(var(--ink))]"
          >
            <ArrowUpDown className="h-4 w-4" strokeWidth={2.2} />
          </button>

          {/* YOU GET */}
          <div className="mt-2 rounded-2xl bg-ink p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/60">
                You get
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-[14px] font-semibold text-white ring-1 ring-white/10">
                {bottomCode} {bottomSymbol}
              </span>
            </div>
            <input
              inputMode="decimal"
              value={getStr}
              onChange={(e) => onGetChange(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="0"
              aria-label={`Amount in ${bottomCode}`}
              className="mt-3 w-full bg-transparent text-[40px] font-extrabold leading-none text-white outline-none placeholder:text-white/30"
            />
          </div>
        </div>

        {/* Quick amounts */}
        <div className="grid grid-cols-4 gap-2.5">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              type="button"
              onClick={() => pickQuick(amt)}
              className="h-12 rounded-full bg-surface-2 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-3 active:bg-surface-3"
            >
              {amt}
            </button>
          ))}
        </div>

        {/* Rate line */}
        <div className="flex items-baseline justify-between px-1 text-[13px]">
          <span className="text-ink">
            1 {topCode} ={" "}
            <span className="font-semibold">
              {bottomSymbol}
              {reversed && rate ? formatAmount(1 / rate, 4) : displayRate}
            </span>
          </span>
          <span className="text-ink-tertiary">
            {loading
              ? "Updating…"
              : error
              ? error
              : rateFetchedAt
              ? `Updated ${timeAgo(rateFetchedAt)}`
              : "—"}
            {" · for reference"}
          </span>
        </div>

        {/* Tips */}
        <section className="pt-2">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-secondary">
            Quick tips when paying in China
          </h2>
          <div className="mt-3 space-y-2.5">
            {TIPS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="flex gap-3 rounded-2xl bg-surface-2 p-4"
              >
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-brand-red">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <div className="text-[15px] font-bold leading-snug text-ink">{title}</div>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Currency picker */}
      {pickerOpen && (
        <button
          type="button"
          aria-label="Close currency picker"
          onClick={() => setPickerOpen(false)}
          className="fixed inset-0 z-40 bg-black/40"
        />
      )}
      <div
        role="dialog"
        aria-modal="true"
        aria-hidden={!pickerOpen}
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[440px] rounded-t-3xl bg-white shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.18)] transition-transform duration-300 ${
          pickerOpen ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
      >
        <div className="flex items-center justify-center pt-3">
          <span className="h-1.5 w-10 rounded-full bg-surface-3" />
        </div>
        <h3 className="px-5 pt-3 text-[16px] font-bold text-ink">Choose currency</h3>
        <ul className="mt-2 max-h-[60vh] overflow-y-auto px-2 pb-2">
          {CURRENCIES.map((c) => {
            const active = c.code === from;
            return (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    setFrom(c.code);
                    setPickerOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-surface-2"
                >
                  <span className="text-xl leading-none">{c.flag}</span>
                  <span className="flex-1">
                    <span className="block text-[15px] font-semibold text-ink">
                      {c.code} · {c.symbol}
                    </span>
                    <span className="block text-[13px] text-ink-secondary">{c.label}</span>
                  </span>
                  {active && <Check className="h-5 w-5 text-ink" strokeWidth={2.2} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </AppLayout>
  );
};

export default Exchange;