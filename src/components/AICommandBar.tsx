import { useEffect, useState } from "react";
import { Sparkles, Mic, ArrowUp, X, Hotel, Car, Map, Languages, MessageSquare } from "lucide-react";
import { toast } from "sonner";

type Suggestion = {
  icon: typeof Sparkles;
  label: string;
  hint: string;
  target: string;
};

const SUGGESTIONS: Suggestion[] = [
  { icon: Hotel, label: "Find a hotel tonight", hint: "Trip.com · pay in your home currency", target: "stays" },
  { icon: Car, label: "Book a quiet DiDi", hint: "AI picks the calmest driver near you", target: "ride" },
  { icon: Map, label: "Find a teahouse with a view", hint: "Scans 1.2km radius in real-time", target: "map" },
  { icon: Languages, label: "How do I order vegetarian?", hint: "Get phrase + pinyin + audio", target: "translate" },
  { icon: MessageSquare, label: "Ask the concierge anything", hint: "Travel plans, etiquette, safety…", target: "concierge" },
];

export const AICommandBar = () => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const route = (s: Suggestion) => {
    setOpen(false);
    toast.success(`AI is opening ${s.label.toLowerCase()}…`, { description: s.hint });
    // Smooth-scroll to relevant section if it exists
    const el = document.getElementById(`section-${s.target}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setOpen(false);
    toast.success("Routing to AI Concierge…", { description: query });
    const el = document.getElementById("section-concierge");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    setQuery("");
  };

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full px-3 py-2.5 text-xs font-semibold text-white shadow-[var(--shadow-glow-cyan)] transition hover:scale-105 sm:bottom-5 sm:right-5 sm:gap-2 sm:px-4 sm:py-3 sm:text-sm"
        style={{ background: "var(--gradient-ai)", paddingBottom: "max(0.625rem, env(safe-area-inset-bottom))" }}
        aria-label="Open AI command bar"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <Sparkles className="h-4 w-4" />
        <span>Ask AI</span>
        <kbd className="ml-1 hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wider sm:inline">⌘K</kbd>
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center bg-[hsl(220_40%_8%/0.55)] p-3 pt-[8vh] backdrop-blur-md sm:p-4 sm:pt-[12vh]"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[hsl(var(--ai-cyan)/0.4)] bg-card shadow-[var(--shadow-glow-cyan)]"
          >
            {/* Scan line */}
            <div className="ai-scan-line pointer-events-none absolute inset-x-0 h-24" />

            <form onSubmit={submit} className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Sparkles className="h-5 w-5 shrink-0 text-[hsl(var(--ai-cyan))]" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Ask anything… 'Find me a Visa-friendly ATM near The Bund'"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => toast.info("Voice input coming soon")}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Voice"
              >
                <Mic className="h-4 w-4" />
              </button>
              <button
                type="submit"
                disabled={!query.trim()}
                className="flex h-8 w-8 items-center justify-center rounded-full text-white disabled:opacity-40"
                style={{ background: "var(--gradient-ai)" }}
                aria-label="Send"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </form>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                AI suggestions for you
              </div>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => route(s)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-muted"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: "var(--gradient-ai)" }}
                  >
                    <s.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{s.hint}</div>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--ai-cyan))]" />
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
              <span className="ai-shimmer-text font-semibold">AI Co-pilot · always on</span>
              <span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5">↵</kbd> to ask
                <span className="mx-1.5">·</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5">esc</kbd> to close
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
};