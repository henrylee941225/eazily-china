import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Maximize2, Star, X } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import type { CityPick } from "@/data/cities";
import { pickCategoryLabel } from "@/lib/pickCategory";

// CJK detector — this app targets foreign travellers, so anything in
// Chinese script gets dropped rather than shown untranslated.
const CJK_RE = /[\u3000-\u303F\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF\u3040-\u30FF]/;
const stripCJK = (s: string | undefined | null): string => {
  if (!s) return "";
  // Drop any token (split on common separators) that contains CJK characters.
  return s
    .split(/([,，·•|/])/)
    .filter((part) => !CJK_RE.test(part))
    .join("")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,·•|/]+|[\s,·•|/]+$/g, "")
    .trim();
};

// Pull the Chinese-script portion out of a mixed string, e.g.
// "123 Nanjing Rd, 南京路123号, 黄浦区" -> "南京路123号, 黄浦区".
const extractCJK = (s: string | undefined | null): string => {
  if (!s) return "";
  const parts = s
    .split(/([,，·•|/])/)
    .filter((part) => CJK_RE.test(part))
    .join("")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,·•|/]+|[\s,·•|/]+$/g, "")
    .trim();
  return parts;
};

// Module-level translation cache keyed by English address text.
const zhAddressCache = new Map<string, string>();
async function translateToZh(text: string): Promise<string> {
  const key = text.trim();
  if (!key) return "";
  if (zhAddressCache.has(key)) return zhAddressCache.get(key)!;
  try {
    const { data, error } = await supabase.functions.invoke("translate", {
      body: { text: key, from: "en", to: "zh" },
    });
    if (error) throw error;
    const zh = String(data?.translated ?? "").trim();
    if (zh) zhAddressCache.set(key, zh);
    return zh;
  } catch (e) {
    console.warn("Address translation failed", e);
    return "";
  }
}

type Detail = {
  verified: boolean;
  summary: string;
  highlights: string[];
  best_time: string;
  how_to_get_there: string;
  what_to_order_or_see: string[];
  insider_tip: string;
  dianping_signal?: string;
  address?: string;
};

type Props = {
  pick: CityPick | null;
  city: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-2xl border border-border bg-white p-4">
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
      {title}
    </h4>
    <div className="text-[15px] leading-relaxed text-ink">{children}</div>
  </section>
);

export const PickDetailSheet = ({ pick, city, open, onOpenChange }: Props) => {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [zhAddress, setZhAddress] = useState<string>("");
  const [showFull, setShowFull] = useState(false);
  const [copiedZh, setCopiedZh] = useState(false);

  useEffect(() => {
    if (!open || !pick) return;
    let cancelled = false;
    setDetail(null);
    setLoading(true);
    setCopied(false);
    setZhAddress("");
    setShowFull(false);
    setCopiedZh(false);

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (!sessionData.session) {
          toast.error("Please sign in to get AI details.");
          if (!cancelled) setLoading(false);
          return;
        }
        const { data, error } = await supabase.functions.invoke("pick-detail", {
          body: { city, title: pick.title, tag: pick.tag, blurb: pick.blurb },
        });
        if (cancelled) return;
        if (error) throw error;
        setDetail(data?.detail ?? null);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Couldn't load AI details. Try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, pick, city]);

  // Resolve a Chinese address for the "Show the driver" card. Prefer the
  // pick's own address field when it already contains Chinese script; then
  // any Chinese fragment inside the AI-returned address; otherwise translate
  // the English AI address via the translate edge function. Never let the
  // guide model invent one.
  useEffect(() => {
    if (!open || !pick) return;
    let cancelled = false;
    const pickAddrZh = extractCJK(pick.address);
    if (pickAddrZh) {
      setZhAddress(pickAddrZh);
      return;
    }
    const aiAddrZh = extractCJK(detail?.address);
    if (aiAddrZh) {
      setZhAddress(aiAddrZh);
      return;
    }
    const enSource = stripCJK(pick.address) || stripCJK(detail?.address);
    if (!enSource) {
      setZhAddress("");
      return;
    }
    (async () => {
      const zh = await translateToZh(enSource);
      if (!cancelled) setZhAddress(zh);
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pick, detail?.address]);

  const zhName = pick?.title_zh ?? "";
  const categoryLabel = pickCategoryLabel(pick);
  const showDriverAvailable = Boolean(zhName || zhAddress);
  const copyZh = async () => {
    const payload = [zhName, zhAddress].filter(Boolean).join("\n");
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedZh(true);
      toast.success("Chinese address copied");
      setTimeout(() => setCopiedZh(false), 2000);
    } catch {
      toast.error("Couldn't copy");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-border bg-white px-5 pb-8"
      >
        <SheetHeader className="text-left">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
            AI insider guide
          </div>
          <SheetTitle className="text-[22px] font-bold leading-tight text-ink">{pick?.title}</SheetTitle>
          <SheetDescription className="flex flex-wrap items-center gap-2 text-[13px]">
            {categoryLabel && (
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
                {categoryLabel}
              </span>
            )}
            {pick?.tag && (
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
                {pick.tag}
              </span>
            )}
            {stripCJK(pick?.meta) && (
              <span className="text-ink-secondary">{stripCJK(pick?.meta)}</span>
            )}
            {pick?.rating != null && (
              <span className="inline-flex items-center gap-1 text-ink-secondary">
                <Star className="h-3 w-3 fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" />
                {pick.rating}
              </span>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-white p-4 text-[14px] text-ink-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Asking the AI concierge…
            </div>
          )}

          {!loading && detail && !detail.verified && (
            <div className="flex items-start gap-2 rounded-2xl border border-border bg-[hsl(var(--tint-warm))] p-3.5 text-[14px] text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-orange))]" />
              <p>{detail.summary || "AI couldn't verify this place — try a similar listed venue."}</p>
            </div>
          )}

          {!loading && detail && detail.verified && (
            <>
              {detail.summary && (
                <p className="text-[15px] leading-relaxed text-ink">{detail.summary}</p>
              )}

              {detail.highlights.length > 0 && (
                <Section title="Why it stands out">
                  <ul className="space-y-1.5">
                    {detail.highlights.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {detail.what_to_order_or_see.length > 0 && (
                <Section title="What to order or see">
                  <ul className="space-y-1.5">
                    {detail.what_to_order_or_see.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </Section>
              )}

              {stripCJK(detail.address) && (
                <Section title="Address">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex-1">{stripCJK(detail.address)}</span>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(stripCJK(detail.address));
                          setCopied(true);
                          toast.success("Address copied");
                          setTimeout(() => setCopied(false), 2000);
                        } catch {
                          toast.error("Couldn't copy address");
                        }
                      }}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-[hsl(var(--surface-3))]"
                      aria-label="Copy address"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </Section>
              )}

              {showDriverAvailable && (
                <section className="rounded-2xl border border-border bg-white p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--brand-red))]">
                      Show the driver
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowFull(true)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-[hsl(var(--surface-3))]"
                      aria-label="Show full screen"
                    >
                      <Maximize2 className="h-3 w-3" />
                      Show full screen
                    </button>
                  </div>
                  {zhName && (
                    <p className="text-[26px] font-extrabold leading-tight text-ink">{zhName}</p>
                  )}
                  {zhAddress && (
                    <p className="mt-2 text-[20px] font-semibold leading-snug text-ink">{zhAddress}</p>
                  )}
                  {zhAddress && (
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={copyZh}
                        className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-ink transition hover:bg-[hsl(var(--surface-3))]"
                        aria-label="Copy Chinese address"
                      >
                        {copiedZh ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        {copiedZh ? "Copied" : "Copy"}
                      </button>
                    </div>
                  )}
                </section>
              )}

              <p className="pt-1 text-[12px] leading-relaxed text-ink-tertiary">
                Written by your concierge AI
              </p>
            </>
          )}
        </div>

        {showFull && (
          <div
            className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[hsl(var(--brand-orange))] to-[#EA470A] px-6 py-[max(24px,env(safe-area-inset-top))] text-white"
            role="dialog"
            aria-label="Show the driver"
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowFull(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              {zhName && (
                <p className="text-[44px] font-extrabold leading-tight">{zhName}</p>
              )}
              {zhAddress && (
                <p className="mt-6 text-[30px] font-semibold leading-snug">{zhAddress}</p>
              )}
            </div>
            <p className="pb-[max(20px,env(safe-area-inset-bottom))] text-center text-[13px] font-medium text-white/80">
              Hold up to show a local driver
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};