import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Mic, Plus, Car, Utensils } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { bookingParamsForVenue, resolveVenueBySlug } from "@/lib/venueBySlug";

type Action =
  | { kind: "book_ride"; label: string; destination: string }
  | { kind: "book_restaurant"; label: string; name: string; slug?: string };

type Msg = {
  role: "user" | "assistant";
  content: string;
  action?: Action;
};

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;
const ACTION_RE = /\[\[ACTION:([a-z_]+)\|([^\]]+)\]\]/i;

function parseAction(raw: string): { cleaned: string; action?: Action } {
  const m = raw.match(ACTION_RE);
  if (!m) return { cleaned: raw };
  const cleaned = raw.replace(ACTION_RE, "").trimEnd();
  const kind = m[1];
  const params: Record<string, string> = {};
  for (const part of m[2].split("|")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    params[part.slice(0, idx).trim()] = part.slice(idx + 1).trim();
  }
  if (kind === "book_ride" && params.destination) {
    return { cleaned, action: { kind: "book_ride", label: params.label || `Book a ride to ${params.destination}`, destination: params.destination } };
  }
  if (kind === "book_restaurant" && params.name) {
    return {
      cleaned,
      action: {
        kind: "book_restaurant",
        label: params.label || `Reserve ${params.name}`,
        name: params.name,
        slug: params.slug || undefined,
      },
    };
  }
  return { cleaned };
}

export const ConciergeChat = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prefillHandledRef = useRef(false);
  // Slug of the venue the conversation was opened about (directory →
  // "Ask concierge to book"). Used to pre-select that venue when the
  // concierge later offers to reserve it.
  const venueSlugHintRef = useRef<string | null>(null);

  // Load persisted history for the current user
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data.user?.id ?? "anon";
      const key = `concierge:chat:${uid}`;
      if (cancelled) return;
      setStorageKey(key);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw) as Msg[];
          if (Array.isArray(parsed)) setMessages(parsed);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      // Cap history to avoid unbounded growth
      const trimmed = messages.slice(-50);
      localStorage.setItem(storageKey, JSON.stringify(trimmed));
    } catch {
      /* ignore quota errors */
    }
  }, [messages, storageKey]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Auto-send prefill passed from the concierge launcher.
  useEffect(() => {
    if (prefillHandledRef.current) return;
    const state = location.state as {
      prefill?: string;
      autoSend?: boolean;
      venueSlug?: string;
    } | null;
    const prefill = state?.prefill?.trim();
    if (!prefill) return;
    prefillHandledRef.current = true;
    venueSlugHintRef.current = state?.venueSlug ?? null;
    const autoSend = state?.autoSend !== false;
    // Clear route state so navigating back/forward doesn't re-send.
    navigate(location.pathname, { replace: true, state: {} });
    if (autoSend) {
      send(prefill);
    } else {
      // Draft-only: place the text into the composer for the user to review.
      setInput(prefill);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const userMsg: Msg = { role: "user", content: trimmed };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        toast.error("Please sign in to use the concierge.");
        setLoading(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ messages: next }),
      });

      if (resp.status === 429) { toast.error("Rate limit reached. Try again in a moment."); setLoading(false); return; }
      if (resp.status === 401) { toast.error("Session expired — please sign in again."); setLoading(false); return; }
      if (resp.status === 402) {
        toast.error("AI credits exhausted. Please try again shortly.");
        setLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error("Stream failed");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantSoFar = "";
      let done = false;

      const upsert = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: "assistant", content: assistantSoFar }];
        });
      };

      while (!done) {
        const { done: d, value } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      const { cleaned, action } = parseAction(assistantSoFar);
      const resolvedAction: Action | undefined =
        action?.kind === "book_restaurant" && !action.slug && venueSlugHintRef.current
          ? { ...action, slug: venueSlugHintRef.current }
          : action;
      if (resolvedAction || cleaned !== assistantSoFar) {
        setMessages((prev) =>
          prev.map((m, i) =>
            i === prev.length - 1 && m.role === "assistant"
              ? { ...m, content: cleaned, action: resolvedAction }
              : m,
          ),
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Concierge is unavailable right now");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="-mx-3 -my-4 flex flex-col bg-white sm:-mx-4 sm:-my-6"
      style={{ minHeight: "calc(100dvh - 12rem)" }}
    >
      {/* Transcript */}
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-6"
      >
        <div className="mx-auto flex max-w-[440px] flex-col gap-3">
          {messages.length === 0 ? (
            <div className="flex justify-start pt-16">
              <div className="max-w-[85%] rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-[15px] leading-snug text-ink">
                Hi there — I'm your Shanghai concierge. Ask me anything: getting around,
                paying, eating, or planning your day.
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="max-w-[85%] rounded-[18px] rounded-br-md bg-ink px-4 py-2.5 text-white">
                    <div className="text-[15px] leading-snug">{m.content}</div>
                  </div>
                ) : (
                  <div className="max-w-[88%] space-y-2">
                    <div className="rounded-[18px] rounded-bl-md bg-surface-2 px-4 py-3 text-ink">
                      <div className="prose prose-sm max-w-none text-ink prose-p:my-1 prose-ul:my-1 prose-headings:my-2 prose-strong:text-ink prose-strong:font-semibold">
                        <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                      </div>
                    </div>
                    {m.action && (
                      <button
                        onClick={() => {
                          if (m.action!.kind === "book_ride") {
                            navigate("/transfers", { state: { destination: m.action!.destination } });
                            return;
                          }
                          // Slug-only lookup across dining → bars → nightlife.
                          // Resolved: open the booking flow with the venue
                          // already selected. Unresolved or no slug: open the
                          // search step with the name pre-filled.
                          const venue = resolveVenueBySlug(m.action!.slug);
                          if (venue) {
                            navigate(`/book/restaurant?${bookingParamsForVenue(venue)}`);
                          } else {
                            navigate(
                              `/book/restaurant?venueSearch=${encodeURIComponent(m.action!.name)}`,
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-surface-2"
                      >
                        {m.action.kind === "book_ride" ? (
                          <Car className="h-3.5 w-3.5" strokeWidth={1.75} />
                        ) : (
                          <Utensils className="h-3.5 w-3.5" strokeWidth={1.75} />
                        )}
                        {m.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
          {loading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-2.5" aria-label="Assistant is typing">
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink/60 [animation-delay:-0.32s]" />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink/60 [animation-delay:-0.16s]" />
                <span className="h-1.5 w-1.5 animate-typing-dot rounded-full bg-ink/60" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer — sticky, matches home/translate styling */}
      <div className="sticky bottom-0 border-t border-border bg-white px-4 pt-3 pb-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto flex max-w-[440px] items-center gap-2"
        >
          <button
            type="button"
            aria-label="Add attachment"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
          >
            <Plus className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="flex flex-1 items-center rounded-full bg-surface-2 px-4">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask anything…"
              disabled={loading}
              className="w-full resize-none border-0 bg-transparent py-2.5 text-[15px] text-ink outline-none placeholder:text-ink-secondary/80 disabled:opacity-60"
              style={{ minHeight: 24, maxHeight: 120 }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            aria-label={input.trim() ? "Send" : "Voice input"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition hover:bg-ink/90 active:scale-95 disabled:opacity-50"
          >
            {input.trim() ? (
              <ArrowUp className="h-5 w-5" strokeWidth={2} />
            ) : (
              <Mic className="h-[18px] w-[18px]" strokeWidth={2} />
            )}
          </button>
        </form>
      </div>
    </div>
  );
};