import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, X, CalendarCheck, Sunrise } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL,
  TONE_CLASSES,
  isTerminal,
  statusTone,
  type ConciergeStatus,
} from "@/lib/conciergeStatus";
import { categoryIcon } from "@/lib/conciergeCategory";
import { usePlan, type GeneratedPlan, type Mood } from "@/contexts/PlanContext";
import { isTransferPastPickupStale } from "@/lib/bookingExpiry";
import { resolvePaymentPresentation } from "@/lib/paymentPhase";

type Row = {
  id: string;
  summary: string;
  details: string | null;
  status: ConciergeStatus;
  category: string;
  created_at: string;
  paid_at: string | null;
  authorized_at: string | null;
  hold_released_at: string | null;
  details_json: unknown;
};

const REQUEST_SENT_KEY = "booking-request-sent";

type SavedPlanRow = {
  id: string;
  title: string;
  city: string | null;
  mood: string | null;
  time_budget_hours: number | null;
  plan: GeneratedPlan;
  updated_at: string;
};

const Bookings = () => {
  const navigate = useNavigate();
  const { setPlan, setMood, setTimeBudget, setCustomHours, setSavedPlanId } = usePlan();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlanRow[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("saved_plans")
        .select("id,title,city,mood,time_budget_hours,plan,updated_at")
        .eq("user_id", u.user.id)
        .order("updated_at", { ascending: false });
      if (!cancelled) setSavedPlans((data ?? []) as unknown as SavedPlanRow[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const openSavedPlan = (row: SavedPlanRow) => {
    setPlan(row.plan);
    setMood((row.mood as Mood) ?? null);
    if (row.time_budget_hours) {
      setTimeBudget("custom");
      setCustomHours(Number(row.time_budget_hours));
    }
    setSavedPlanId(row.id);
    navigate("/ai/plan/result");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const v = sessionStorage.getItem(REQUEST_SENT_KEY);
      if (v) setBanner(v);
    }
  }, []);

  const dismissBanner = () => {
    setBanner(null);
    sessionStorage.removeItem(REQUEST_SENT_KEY);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("concierge_tasks")
        .select("id,summary,details,status,category,created_at,paid_at,authorized_at,hold_released_at,details_json")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (!cancelled) setRows((data ?? []) as Row[]);
    })();

    const channel = supabase
      .channel("bookings:list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "concierge_tasks" },
        () => {
          supabase.auth.getUser().then(({ data: u }) => {
            if (!u.user) return;
            supabase
              .from("concierge_tasks")
              .select("id,summary,details,status,category,created_at,paid_at,authorized_at,hold_released_at,details_json")
              .eq("user_id", u.user.id)
              .order("created_at", { ascending: false })
              .then(({ data }) => {
                if (!cancelled) setRows((data ?? []) as Row[]);
              });
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  const { upcoming, past } = useMemo(() => {
    const list = rows ?? [];
    const up: Row[] = [];
    const pa: Row[] = [];
    for (const r of list) {
      if (isTerminal(r.status) || isTransferPastPickupStale(r)) pa.push(r);
      else up.push(r);
    }
    return { upcoming: up, past: pa };
  }, [rows]);

  const visible = tab === "upcoming" ? upcoming : past;

  return (
    <AppLayout title="My bookings" showBack={false}>
      <div className="mx-auto max-w-[440px] space-y-4">
        {/* Segmented control */}
        <div className="flex items-center gap-2">
          {(["upcoming", "past"] as const).map((t) => {
            const active = tab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`rounded-full px-4 py-2 text-[13px] font-semibold transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-surface-2 text-ink hover:bg-surface-3"
                }`}
              >
                {t === "upcoming" ? "Upcoming" : "Past"}
              </button>
            );
          })}
        </div>

        {/* Request sent banner */}
        {banner && tab === "upcoming" && (
          <div className="flex items-center gap-3 rounded-2xl bg-ink px-3.5 py-3 text-white">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success text-white">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold leading-tight">Request sent</p>
              <p className="text-[12px] leading-snug text-white/70">
                We'll confirm your booking shortly.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissBanner}
              aria-label="Dismiss"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        )}

        {/* List */}
        {rows === null ? (
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-surface-2" />
            ))}
          </div>
        ) : visible.length === 0 && !(tab === "upcoming" && savedPlans && savedPlans.length > 0) ? (
          <EmptyState tab={tab} onOpenConcierge={() => navigate("/concierge/chat")} />
        ) : (
          <ul className="space-y-3">
            {visible.map((r) => (
              <BookingRow
                key={r.id}
                row={r}
                onOpen={() => navigate(`/bookings/${r.id}`)}
              />
            ))}
          </ul>
        )}

        {/* Your days — saved plans, upcoming tab only */}
        {tab === "upcoming" && savedPlans && savedPlans.length > 0 && (
          <section aria-label="Your days" className="pt-2">
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-secondary">
              Your days
            </h2>
            <ul className="space-y-3">
              {savedPlans.map((sp) => {
                const total = sp.plan?.stops?.length ?? 0;
                const doneCount = (sp.plan?.stops ?? []).filter((s) => s.done).length;
                const complete = total > 0 && doneCount === total;
                return (
                  <li key={sp.id}>
                    <button
                      type="button"
                      onClick={() => openSavedPlan(sp)}
                      className="flex w-full items-center gap-3 rounded-2xl bg-ink p-3 text-left text-white transition-opacity hover:opacity-95"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--brand-orange)/0.16)] text-[hsl(var(--brand-orange))]">
                        <Sunrise className="h-[18px] w-[18px]" strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold">{sp.title}</p>
                        <p className="mt-0.5 truncate text-[12px] text-white/70">
                          {total} {total === 1 ? "stop" : "stops"}
                          {sp.city ? ` · ${sp.city}` : ""}
                          {complete ? " · Completed" : total > 0 ? ` · ${doneCount} of ${total} done` : ""}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/60" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

const BookingRow = ({
  row,
  onOpen,
}: {
  row: Row;
  onOpen: () => void;
}) => {
  const Icon = categoryIcon(row.category);
  const phase = resolvePaymentPresentation(row);
  const stale = !!phase?.stale;
  const tone = phase ? phase.toneClasses : TONE_CLASSES[statusTone(row.status)];
  const meta = row.details?.trim() || "Human assistant · usually replies in < 5 min";
  const label = phase ? phase.chipLabel : STATUS_LABEL[row.status];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left transition hover:bg-surface-2/60 ${stale ? "opacity-70" : ""}`}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-ink">{row.summary}</p>
          <p className="mt-0.5 truncate text-[12px] text-ink-secondary">{meta}</p>
          <span
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.bg} ${tone.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
            {label}
          </span>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
      </button>
    </li>
  );
};

const EmptyState = ({
  tab,
  onOpenConcierge,
}: {
  tab: "upcoming" | "past";
  onOpenConcierge: () => void;
}) => (
  <div className="rounded-2xl border border-dashed border-border bg-white p-6 text-center">
    <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink">
      <CalendarCheck className="h-5 w-5" strokeWidth={1.7} />
    </span>
    <p className="mt-3 text-[15px] font-semibold text-ink">
      {tab === "upcoming" ? "No bookings yet" : "Nothing here yet"}
    </p>
    <p className="mt-1 text-[12px] leading-snug text-ink-secondary">
      {tab === "upcoming"
        ? "Ask the concierge to book a table, tickets, or hold a queue for you."
        : "Past and cancelled bookings will appear here."}
    </p>
    {tab === "upcoming" && (
      <button
        type="button"
        onClick={onOpenConcierge}
        className="mt-4 inline-flex items-center rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-white"
      >
        Ask the concierge
      </button>
    )}
  </div>
);

export default Bookings;