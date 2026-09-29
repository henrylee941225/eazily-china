import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const BOOKING_MESSAGES_ANCHOR = "booking-messages";
export const FOCUS_BOOKING_COMPOSER_EVENT = "eazily:focus-booking-composer";

type Msg = {
  id: string;
  sender: "user" | "assistant" | "system";
  body: string;
  created_at: string;
};

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} · ${d.toLocaleTimeString(
    "en-GB",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
};

/**
 * Messages on a transfer booking: the task's own message log (customer, ops
 * replies and system notes) plus a composer bound to THIS task. Sends through
 * the existing concierge-send-message function — no gate, unlike the
 * AI concierge chat. Terminal bookings render read-only.
 */
export const TransferMessages = ({
  taskId,
  canSend,
}: {
  taskId: string;
  canSend: boolean;
}) => {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("concierge_messages")
      .select("id,sender,body,created_at")
      .eq("task_id", taskId)
      .order("created_at");
    if (data) setMessages(data as Msg[]);
  }, [taskId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`booking-messages:${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "concierge_messages",
          filter: `task_id=eq.${taskId}`,
        },
        (payload) =>
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Msg).id) ? prev : [...prev, payload.new as Msg],
          ),
      )
      .subscribe();
    // Belt and braces: refresh when the app regains focus.
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      supabase.removeChannel(channel);
    };
  }, [taskId, load]);

  // Deep link from the inside-24h cancellation row.
  useEffect(() => {
    const focus = () => {
      inputRef.current?.focus();
    };
    window.addEventListener(FOCUS_BOOKING_COMPOSER_EVENT, focus);
    return () => window.removeEventListener(FOCUS_BOOKING_COMPOSER_EVENT, focus);
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const { error } = await supabase.functions.invoke("concierge-send-message", {
      body: { task_id: taskId, body: text },
    });
    setSending(false);
    if (error) {
      toast.error("Couldn't send message. Try again.");
      return;
    }
    setInput("");
    load();
  };

  return (
    <section id={BOOKING_MESSAGES_ANCHOR} className="rounded-2xl border border-border bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-secondary">Messages</p>

      {messages.length === 0 ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-[13px] leading-snug text-ink-secondary">
          <MessageSquare className="h-4 w-4 shrink-0" strokeWidth={1.9} />
          {canSend
            ? "No messages yet. Send a note and a person will reply."
            : "No messages on this booking."}
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          {messages.map((m) =>
            m.sender === "system" ? (
              <div key={m.id} className="flex justify-center">
                <p className="rounded-full bg-surface-2 px-3 py-1.5 text-center text-[11px] leading-snug text-ink-secondary">
                  {m.body}
                </p>
              </div>
            ) : (
              <div key={m.id} className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <div
                    className={`rounded-[18px] px-3.5 py-2.5 text-[14px] leading-snug ${
                      m.sender === "user"
                        ? "rounded-br-[6px] bg-ink text-white"
                        : "rounded-bl-[6px] bg-surface-2 text-ink"
                    }`}
                  >
                    {m.body}
                  </div>
                  <p
                    className={`mt-1 text-[11px] text-ink-tertiary ${
                      m.sender === "user" ? "text-right" : "text-left"
                    }`}
                  >
                    {m.sender === "user" ? "You" : "Concierge"} · {timeLabel(m.created_at)}
                  </p>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {canSend && (
        <form onSubmit={send} className="mt-3 flex items-center gap-2">
          <div className="flex flex-1 items-center rounded-full bg-surface-2 px-4">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Message the concierge…"
              className="w-full border-0 bg-transparent py-2.5 text-[14px] text-ink outline-none placeholder:text-ink-secondary/80"
            />
          </div>
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-ink/90 disabled:opacity-40"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
            ) : (
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            )}
          </button>
        </form>
      )}
    </section>
  );
};
