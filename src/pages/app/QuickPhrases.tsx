import { useMemo, useState } from "react";
import { Bookmark, Maximize2, Search, Volume2, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { QUICK_PHRASE_CATEGORIES, type QuickPhrase } from "@/data/quickPhrases";
import { speak } from "@/lib/speech";

const QuickPhrases = () => {
  const [activeKey, setActiveKey] = useState(QUICK_PHRASE_CATEGORIES[0].key);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [preview, setPreview] = useState<QuickPhrase | null>(null);

  const active = QUICK_PHRASE_CATEGORIES.find((c) => c.key === activeKey) ?? QUICK_PHRASE_CATEGORIES[0];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return active.phrases;
    return active.phrases.filter((p) => p.en.toLowerCase().includes(q));
  }, [active, query]);

  const headerRight = (
    <button
      type="button"
      aria-label={searchOpen ? "Close search" : "Search phrases"}
      onClick={() => {
        setSearchOpen((v) => {
          if (v) setQuery("");
          return !v;
        });
      }}
      className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
    >
      {searchOpen ? <X className="h-5 w-5" strokeWidth={2} /> : <Search className="h-5 w-5" strokeWidth={2} />}
    </button>
  );

  return (
    <AppLayout title="Quick phrases" showBack backTo="/translate" headerRight={headerRight}>
      <div className="mx-auto max-w-2xl">
        {searchOpen && (
          <div className="mb-3 flex items-center gap-2 rounded-full bg-surface-2 px-4 py-2.5">
            <Search className="h-4 w-4 text-ink-secondary" strokeWidth={2} />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search phrases"
              aria-label="Search phrases"
              className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-tertiary"
            />
          </div>
        )}

        {/* Category tabs — underlined text tabs */}
        <div className="mb-2 flex items-center gap-6 border-b border-hairline">
          {QUICK_PHRASE_CATEGORIES.map((c) => {
            const activeTab = c.key === activeKey;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setActiveKey(c.key)}
                className="relative -mb-px py-3 text-[15px] font-semibold transition-colors"
                style={{ color: activeTab ? "hsl(var(--ink))" : "hsl(var(--ink-secondary))" }}
              >
                {c.label}
                {activeTab && (
                  <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-brand-red" />
                )}
              </button>
            );
          })}
        </div>

        {/* Phrase rows */}
        <ul className="pb-24">
          {rows.map((p) => (
            <li key={p.en}>
              <div className="flex items-center gap-3 border-b border-hairline py-4">
                <button
                  type="button"
                  onClick={() => setPreview(p)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="text-[16px] font-semibold text-ink">{p.en}</div>
                  <div className="mt-0.5 text-[15px] text-ink-secondary">{p.zh}</div>
                  <div className="mt-0.5 text-[13px] text-ink-tertiary">{p.pinyin}</div>
                </button>
                <button
                  type="button"
                  aria-label={`Play ${p.en}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(p.zh, "zh-CN");
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  <Volume2 className="h-5 w-5" strokeWidth={2} />
                </button>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="py-8 text-center text-[13px] text-ink-secondary">No matches</li>
          )}
        </ul>
      </div>

      {/* Show overlay — mirrors the Translator Show card */}
      {preview && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-b from-[#FF7A00] to-[#D63A0A] text-white"
          style={{
            paddingTop: "max(env(safe-area-inset-top), 12px)",
            paddingBottom: "max(env(safe-area-inset-bottom), 16px)",
          }}
        >
          <div className="flex items-center justify-between px-5 pt-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/90">
              Show this
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setPreview(null)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/25 active:bg-white/30"
            >
              <X className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
            <div className="mb-8 h-px w-8 bg-white/60" />
            <p className="text-[30px] font-semibold leading-[1.25] text-white">{preview.zh}</p>
            {preview.pinyin && (
              <p className="mt-3 text-[15px] italic text-white/85">{preview.pinyin}</p>
            )}
            <p className="mt-5 text-[15px] leading-snug text-white/80">{preview.en}</p>
          </div>

          <div className="flex items-center gap-3 px-5">
            <button
              type="button"
              onClick={() => speak(preview.zh, "zh-CN")}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white text-[15px] font-semibold text-[#D63A0A] shadow-[0_8px_24px_rgba(0,0,0,0.12)] active:bg-white/95"
            >
              <Volume2 className="h-5 w-5" strokeWidth={2} />
              Play aloud
            </button>
            <button
              type="button"
              aria-label="Save"
              className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/25 active:bg-white/30"
            >
              <Bookmark className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default QuickPhrases;