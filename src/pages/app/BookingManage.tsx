import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Send, XCircle, Loader2, CheckCircle2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  CANCELLATION_CLOSED_LINE,
  formatFreeCancellationUntil,
  isCancellationWindowClosed,
} from "@/lib/transferCancellation";
import { cancelTaskWithPolicy } from "@/lib/cancelTask";

type Task = {
  id: string;
  summary: string;
  details: string | null;
  status: string;
  category: string;
  details_json: unknown;
};

const CHIPS = [
  { label: "Change time", text: "Could we change the time — " },
  { label: "Change party size", text: "Could we change the party size to " },
  { label: "Add a request", text: "One more request: " },
];

const BookingManage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from("concierge_tasks")
        .select("id,summary,details,status,category,details_json")
        .eq("id", id)
        .maybeSingle();
      if (data) setTask(data as Task);
    })();
  }, [id]);

  const appendChip = (t: string) => {
    setText((prev) => (prev.trim() ? `${prev.trim()}\n${t}` : t));
  };

  const send = async () => {
    if (!id || sending) return;
    const body = text.trim();
    if (body.length < 4) {
      toast.error("Add a short note for the concierge");
      return;
    }
    setSending(true);
    try {
      const { error: mErr } = await supabase.functions.invoke("concierge-send-message", {
        body: { task_id: id, body },
      });
      if (mErr) throw mErr;
      const { error: uErr } = await supabase.functions.invoke("concierge-update-task", {
        body: { task_id: id, status: "change_pending" },
      });
      if (uErr) throw uErr;
      setSent(true);
    } catch (e) {
      console.error(e);
      toast.error("Couldn't send your change. Try again.");
    } finally {
      setSending(false);
    }
  };

  const cancel = async () => {
    if (!id) return;
    if (!confirm("Cancel this reservation? This can't be undone.")) return;
    const result = await cancelTaskWithPolicy(id);
    if (!result.ok) {
      toast.error(result.message ?? "Couldn't cancel. Try again.");
      return;
    }
    toast.success("Reservation cancelled");
    navigate(`/bookings/${id}`);
  };

  // Transfer cancellation policy: free cancellation until 24 hours before
  // pickup on CONFIRMED transfers. Inside the window the in-app cancel is
  // replaced by a concierge route. Unconfirmed transfers are unchanged.
  const cancellationClosed = task
    ? isCancellationWindowClosed({
        status: task.status,
        category: task.category,
        details_json: task.details_json,
      })
    : false;
  const freeUntilLine =
    task && task.category === "transfer" && task.status === "confirmed"
      ? formatFreeCancellationUntil(task.details_json)
      : null;

  if (!id) return null;

  if (sent) {
    return (
      <AppLayout title="Change request sent" backTo={`/bookings/${id}`}>
        <div className="mx-auto flex max-w-[440px] flex-col items-center pt-8 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-tint-warm text-brand-red">
            <Send className="h-6 w-6" strokeWidth={2} />
          </span>
          <h2 className="mt-5 text-[22px] font-extrabold leading-tight text-ink">
            Change request sent
          </h2>
          <p className="mt-2 max-w-[320px] text-[14px] leading-snug text-ink-secondary">
            A person is checking with the venue about your requested change.
          </p>

          <div className="mt-6 w-full space-y-3 rounded-2xl bg-surface-2 p-4 text-left">
            <StepRow state="done" label="Your message reached the concierge" />
            <StepRow state="active" label="A person is confirming the change" />
            <StepRow state="todo" label="We'll update your reservation" />
          </div>

          <div className="mt-4 w-full rounded-2xl border border-border bg-white p-4 text-left text-[13px] leading-snug text-ink-secondary">
            Current booking still held until the change is confirmed.
          </div>

          <button
            type="button"
            onClick={() => navigate(`/bookings/${id}`)}
            className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-ink/90"
          >
            Back to booking
          </button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Manage reservation"
      subtitle={task ? task.summary : undefined}
      backTo={`/bookings/${id}`}
    >
      <div className="mx-auto max-w-[440px] space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">
            Ask the concierge for a change
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            placeholder="e.g. Could we move to 8pm and ask for a quieter table?"
            className="mt-2 w-full rounded-2xl bg-surface-2 px-3.5 py-3 text-[14px] leading-snug text-ink outline-none placeholder:text-ink-secondary/80 focus:ring-1 focus:ring-ink/30"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => appendChip(c.text)}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition hover:bg-surface-2"
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" strokeWidth={2} />
          )}
          Send to concierge
        </button>

        <div className="border-t border-border pt-4">
          {cancellationClosed ? (
            <div className="rounded-2xl bg-surface-2 p-4">
              <p className="text-[13px] leading-snug text-ink-secondary">
                {CANCELLATION_CLOSED_LINE}
              </p>
              <button
                type="button"
                onClick={() => navigate(`/bookings/${id}#booking-messages`)}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-border bg-white px-4 py-3 text-[14px] font-semibold text-ink transition hover:bg-surface-3"
              >
                <MessageSquare className="h-4 w-4" strokeWidth={2} />
                Message the concierge
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={cancel}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-red/60 bg-white px-4 py-3.5 text-[15px] font-semibold text-brand-red transition hover:bg-error-tint/40"
              >
                <XCircle className="h-4 w-4" strokeWidth={2} />
                {task?.category === "transfer" ? "Cancel transfer" : "Cancel reservation"}
              </button>
              {freeUntilLine && (
                <p className="mt-2 text-center text-[12px] leading-snug text-ink-secondary">
                  {freeUntilLine}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

const StepRow = ({
  state,
  label,
}: {
  state: "done" | "active" | "todo";
  label: string;
}) => {
  if (state === "done") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success text-white">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.4} />
        </span>
        <span className="text-[13px] text-ink">{label}</span>
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="flex items-center gap-3">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-pending">
          <span className="h-2 w-2 rounded-full bg-pending" />
        </span>
        <span className="text-[13px] font-semibold text-ink">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <span className="h-5 w-5 rounded-full border-2 border-ink-tertiary/40" />
      <span className="text-[13px] text-ink-secondary">{label}</span>
    </div>
  );
};

export default BookingManage;