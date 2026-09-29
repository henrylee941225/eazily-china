import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Sunrise, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { GeneratedPlan } from "@/contexts/PlanContext";
import { isPlanSuppressed } from "@/lib/hideFromHome";

type Row = { id: string; title: string; plan: GeneratedPlan; updated_at: string };

const formatStopTime = (hhmm: string): string => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const h = Number(m[1]);
  const mm = m[2];
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mm} ${suffix}`;
};

type Props = {
  hidden?: string[];
  onHide?: (id: string, label: string) => void;
};

export const TodaysPlanCard = ({ hidden = [], onHide }: Props) => {
  const { user } = useAuth();
  const [row, setRow] = useState<Row | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) { setLoaded(true); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("saved_plans")
        .select("id,title,plan,updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      setRow(((data ?? [])[0] as unknown as Row) ?? null);
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!loaded || !row) return null;
  if (isPlanSuppressed(hidden, row.id)) return null;
  const stops = row.plan?.stops ?? [];
  if (stops.length === 0) return null;
  const total = stops.length;
  const doneCount = stops.filter((s) => s.done).length;
  const nextStop = stops.find((s) => !s.done) ?? stops[stops.length - 1];
  const complete = doneCount >= total;

  return (
    <section aria-label="Today's plan">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="text-[20px] font-bold text-ink">Today's plan</h2>
        <Link to="/ai/plan/result" className="text-[14px] font-semibold text-[hsl(var(--brand-red))]">
          View
        </Link>
      </div>
      <div className="relative">
        <Link
          to="/ai/plan/result"
          className="block rounded-2xl border border-border bg-white p-3.5 transition-colors hover:bg-surface-2/60"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--brand-orange)/0.12)] text-[hsl(var(--brand-orange))]">
              <Sunrise className="h-5 w-5" strokeWidth={1.9} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate pr-8 text-[15px] font-semibold text-ink">{row.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-ink-secondary">
                {complete
                  ? `Day complete · ${total} of ${total} done`
                  : `Next: ${nextStop.placeName} · ${formatStopTime(nextStop.startTime)}`}
              </p>
            </div>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
              {doneCount} of {total}
            </span>
          </div>
        </Link>
        {onHide && (
          <button
            type="button"
            aria-label="Plan options"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onHide(row.id, row.title);
            }}
            className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-2"
          >
            <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
          </button>
        )}
      </div>
    </section>
  );
};

export default TodaysPlanCard;