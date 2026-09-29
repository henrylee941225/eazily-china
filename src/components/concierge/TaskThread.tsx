import { useEffect, useState } from "react";
import { ArrowUp, Loader2, X, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  STATUS_LABEL,
  TONE_CLASSES,
  isActive,
  statusTone,
  type ConciergeStatus,
} from "@/lib/conciergeStatus";
import { resolvePaymentPresentation } from "@/lib/paymentPhase";

type Task = {
  id: string;
  status: ConciergeStatus;
  summary: string;
  assistant_id: string | null;
  booking_reference: string | null;
  user_id: string;
  category: string;
  paid_at: string | null;
  authorized_at: string | null;
  hold_released_at: string | null;
  details_json: unknown;
};
type Msg = {
  id: string;
  sender: "user" | "assistant" | "system";
  body: string;
  created_at: string;
};

export const TaskThread = ({ taskId }: { taskId: string }) => {
  const [task, setTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMe(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: t }, { data: m }] = await Promise.all([
        supabase
          .from("concierge_tasks")
          .select("id,status,summary,assistant_id,booking_reference,user_id,category,paid_at,authorized_at,hold_released_at,details_json")
          .eq("id", taskId)
          .maybeSingle(),
        supabase.from("concierge_messages").select("id,sender,body,created_at").eq("task_id", taskId).order("created_at"),
      ]);
      if (cancelled) return;
      if (t) setTask(t as Task);
      if (m) setMessages(m as Msg[]);
    })();

    const channel = supabase
      .channel(`task:${taskId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "concierge_messages", filter: `task_id=eq.${taskId}` },
        (payload) => setMessages((prev) => [...prev, payload.new as Msg]),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "concierge_tasks", filter: `id=eq.${taskId}` },
        (payload) => setTask((p) => (p ? { ...p, ...(payload.new as Task) } : (payload.new as Task))),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [taskId]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("concierge-send-message", {
        body: { task_id: taskId, body: text },
      });
      if (error) throw error;
      setInput("");
    } catch {
      toast.error("Couldn't send message");
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!confirm("Cancel this human-assistant task?")) return;
    const { error } = await supabase.functions.invoke("concierge-update-task", {
      body: { task_id: taskId, status: "cancelled" },
    });
    if (error) toast.error("Couldn't cancel");
  };

  if (!task) return null;
  const active = isActive(task.status);
  const isOwner = me != null && task.user_id === me;
  const phase = resolvePaymentPresentation(task);
  const displayStatusLabel = phase ? phase.chipLabel : STATUS_LABEL[task.status];
  const tone = phase ? phase.toneClasses : TONE_CLASSES[statusTone(task.status)];
  const confirmedLike = task.status === "confirmed" || task.status === "completed";

  return (
    <div className="rounded-2xl border border-border bg-white p-3">
      {/* Status banner */}
      <div className={`flex items-center justify-between gap-2 rounded-xl ${tone.bg} px-3 py-2`}>
        <div className="flex items-center gap-2 text-[12px]">
          <span
            className={`h-2 w-2 rounded-full ${tone.dot} ${active ? "animate-pulse" : ""}`}
            aria-hidden
          />
          <span className="font-semibold text-ink">Human assistant</span>
          <span className={`font-semibold uppercase tracking-wider text-[10px] ${tone.text}`}>
            · {displayStatusLabel}
          </span>
        </div>
        {active && (
          <button
            onClick={cancel}
            aria-label="Cancel task"
            className="flex h-7 w-7 items-center justify-center rounded-full text-ink-secondary transition hover:bg-white/60 hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-snug text-ink-secondary">{task.summary}</p>
      {confirmedLike && task.booking_reference && (
        <p className="mt-1 px-1 text-[11px] font-semibold uppercase tracking-wider text-success">
          Ref {task.booking_reference}
        </p>
      )}

      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
            {m.sender === "system" ? (
              <div className="mx-auto rounded-full bg-surface-2 px-2.5 py-1 text-[10px] text-ink-secondary">
                {m.body}
              </div>
            ) : (
              <div
                className={`max-w-[85%] rounded-[14px] px-3 py-2 text-[13px] leading-snug ${
                  m.sender === "user"
                    ? "rounded-br-[6px] bg-ink text-white"
                    : "rounded-bl-[6px] bg-surface-2 text-ink"
                }`}
              >
                {m.body}
              </div>
            )}
          </div>
        ))}
      </div>

      {active ? (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-full bg-surface-2 px-3.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message your assistant…"
              className="w-full border-0 bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-ink-secondary/80"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-ink/90 disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
          </button>
        </form>
      ) : confirmedLike ? (
        <div className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-success-tint px-3 py-1.5 text-[11px] font-semibold text-success">
          <CheckCircle2 className="h-3.5 w-3.5" /> {displayStatusLabel}
        </div>
      ) : null}
    </div>
  );
};