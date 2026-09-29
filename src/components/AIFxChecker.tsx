import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowRightLeft, Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";

const CURRENCIES = ["CNY", ...SUPPORTED_CURRENCIES.map((c) => c.code)];

type FxResult = {
  rate: number;
  converted: number;
  trend: string;
  tip: string;
};

export const AIFxChecker = () => {
  const { currency } = useCurrency();
  const [from, setFrom] = useState<string>(currency);
  const [to, setTo] = useState("CNY");
  const [amount, setAmount] = useState("100");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FxResult | null>(null);

  useEffect(() => {
    setFrom(currency);
    setResult(null);
  }, [currency]);

  const swap = () => {
    setFrom(to);
    setTo(from);
    setResult(null);
  };

  const check = async () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    if (from === to) {
      toast.error("Pick two different currencies");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("fx-check", {
        body: { from, to, amount: amt },
      });
      if (error) {
        const status = (error as { context?: { status?: number } }).context?.status;
        if (status === 429) toast.error("AI is busy — try again in a moment");
        else if (status === 402) toast.error("AI credits exhausted");
        else if (status === 401) toast.error("Please sign in to use AI features");
        else if (status === 403) toast.error("AI currency check is unavailable right now");
        else toast.error("Couldn't fetch FX quote");
        return;
      }
      setResult(data as FxResult);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't fetch FX quote");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-[hsl(var(--ai-violet)/0.3)] bg-[hsl(var(--ai-violet)/0.04)] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--ai-violet))]">
          <Sparkles className="h-3 w-3" />
          AI Currency Exchange
        </div>
        <span className="text-[10px] text-muted-foreground">indicative · live AI</span>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
        <select
          value={from}
          onChange={(e) => { setFrom(e.target.value); setResult(null); }}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-semibold outline-none focus:border-[hsl(var(--ai-violet))]"
          aria-label="From currency"
        >
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={swap}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-[hsl(var(--ai-violet))]"
          aria-label="Swap currencies"
        >
          <ArrowRightLeft className="h-3.5 w-3.5" />
        </button>
        <select
          value={to}
          onChange={(e) => { setTo(e.target.value); setResult(null); }}
          className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm font-semibold outline-none focus:border-[hsl(var(--ai-violet))]"
          aria-label="To currency"
        >
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          value={amount}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            // Allow only digits and a single decimal point — keeps native
            // text editing (select-all, drag, long-press) which `type="number"` blocks.
            const cleaned = e.target.value.replace(/[^0-9.]/g, "").replace(/(\..*?)\./g, "$1");
            setAmount(cleaned);
            setResult(null);
          }}
          className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-right text-sm font-semibold outline-none focus:border-[hsl(var(--ai-violet))]"
          aria-label="Amount"
        />
      </div>

      <button
        onClick={check}
        disabled={loading}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition disabled:opacity-60"
        style={{ background: "var(--gradient-ai)" }}
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        {loading ? "Checking with AI…" : "Check rate with AI"}
      </button>

      {result && (
        <div className="mt-3 space-y-2">
          <div className="flex items-baseline justify-between rounded-lg border border-[hsl(var(--ai-cyan)/0.3)] bg-[hsl(var(--ai-cyan)/0.06)] px-3 py-2">
            <div className="text-xs text-muted-foreground">
              {amount} {from} =
            </div>
            <div className="ai-shimmer-text text-lg font-bold">
              {result.converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {to}
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-[hsl(var(--ai-cyan))]" />
            <span>1 {from} ≈ {result.rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to} · {result.trend}</span>
          </div>
          <p className="rounded-lg border border-[hsl(var(--ai-violet)/0.25)] bg-[hsl(var(--ai-violet)/0.06)] px-3 py-2 text-[11px] text-foreground/80">
            <span className="font-semibold text-[hsl(var(--ai-violet))]">AI tip:</span> {result.tip}
          </p>
        </div>
      )}
    </div>
  );
};