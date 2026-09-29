import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { UserRound, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { TaskThread } from "@/components/concierge/TaskThread";
import { STATUS_LABEL, statusTone, type ConciergeStatus } from "@/lib/conciergeStatus";
import { resolvePaymentPresentation } from "@/lib/paymentPhase";

type TaskRow = {
  id: string;
  summary: string;
  status: ConciergeStatus;
  created_at: string;
  price_cents: number;
  currency: string;
  category: string;
  paid_at: string | null;
  authorized_at: string | null;
  hold_released_at: string | null;
  details_json: unknown;
};

const TONE_CHIP: Record<ReturnType<typeof statusTone>, string> = {
  pending: "bg-pending-tint text-pending",
  success: "bg-success-tint text-success",
  error: "bg-error-tint text-error",
};
const STATUS_COLOR = (s: ConciergeStatus) => TONE_CHIP[statusTone(s)];

const ConciergeTasks = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("concierge_tasks")
        .select("id,summary,status,created_at,price_cents,currency,category,paid_at,authorized_at,hold_released_at,details_json")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false });
      if (!cancelled && data) setTasks(data as TaskRow[]);
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppLayout title="Human travel concierge" subtitle="Bilingual locals handling things AI can't" backTo="/">
      <div className="mx-auto max-w-2xl space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-foreground/15 bg-card p-6 text-center">
            <UserRound className="mx-auto h-6 w-6 text-muted-foreground" />
            <p className="mt-2 text-sm text-ink">No human-assistant tasks yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ask the AI concierge — when something needs a Chinese number or phone call, you'll see a "Request human" card.
            </p>
            <button
              onClick={() => navigate("/concierge/chat")}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-vermilion px-4 py-2 text-sm text-cream"
            >
              Open AI concierge
            </button>
          </div>
        ) : (
          tasks.map((t) => {
            const phase = resolvePaymentPresentation(t);
            return (
            <div key={t.id} className="rounded-2xl border border-foreground/10 bg-card shadow-soft">
              <button
                onClick={() => setOpen((p) => (p === t.id ? null : t.id))}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${phase ? `${phase.toneClasses.bg} ${phase.toneClasses.text}` : STATUS_COLOR(t.status)}`}>
                      {phase ? phase.chipLabel : STATUS_LABEL[t.status]}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-ink">{t.summary}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(t.price_cents / 100).toFixed(0)} {t.currency}
                  </p>
                </div>
                <ChevronRight className={`h-4 w-4 text-muted-foreground transition ${open === t.id ? "rotate-90" : ""}`} />
              </button>
              {open === t.id && (
                <div className="border-t border-foreground/10 p-3">
                  <TaskThread taskId={t.id} />
                </div>
              )}
            </div>
            );
          })
        )}
      </div>
    </AppLayout>
  );
};

export default ConciergeTasks;