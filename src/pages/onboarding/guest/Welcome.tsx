import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Mic, Sparkles, CalendarDays, CircleCheck, Plane, Car, Map as MapIcon, ArrowLeftRight, Languages, BookOpen } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Persist completion locally so the flow doesn't re-appear on this device.
// This is a fresh-device cache only — the source of truth is
// `profiles.welcome_completed` for logged-in users (synced on completion,
// and on sign-in via WelcomeSync).
const LS_KEY = "eazilychina:welcomeCompleted";
export const markWelcomeCompletedLocal = () => {
  try { localStorage.setItem(LS_KEY, "true"); } catch { /* ignore */ }
};

type Slide = {
  id: string;
  headline: string;
  subcopy: string;
  /** Pastel gradient tint behind the mini preview card. */
  tint: string;
  preview: ReactNode;
};

// ---------- Mini UI previews (decorative — no real interactions) ----------

const PreviewCompanion = () => (
  <div className="rounded-3xl bg-white p-5 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.25)]">
    <div className="flex justify-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[hsl(var(--brand-orange-from))] to-[hsl(var(--brand-orange-to))] text-white">
        <Sparkles className="h-5 w-5" strokeWidth={2.2} />
      </div>
    </div>
    <div className="mt-3 text-center text-[15px] font-bold text-ink">Where to today, Alex?</div>
    <div className="mt-3 flex justify-center gap-1.5">
      {["Book dinner", "Find nearby", "Plan a day"].map((c) => (
        <div key={c} className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-medium text-ink">{c}</div>
      ))}
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-full bg-surface-2 px-3 py-2">
      <span className="flex-1 text-[12px] text-ink-tertiary">Ask anything…</span>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
        <ArrowRight className="h-3.5 w-3.5" />
      </div>
    </div>
  </div>
);

const PreviewConcierge = () => (
  <div className="rounded-3xl bg-white p-4 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.25)]">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-brand-red">
      <Sparkles className="h-3 w-3" /> Concierge
    </div>
    <div className="mt-3 flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-ink px-3 py-2 text-[12px] text-white">
        Do I need cash, or is Alipay enough?
      </div>
    </div>
    <div className="mt-2 flex">
      <div className="max-w-[90%] rounded-2xl rounded-bl-md bg-surface-2 px-3 py-2 text-[12px] leading-snug text-ink">
        Alipay covers almost everything — I can set it up with you now. Want me to?
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-full bg-surface-2 px-3 py-2">
      <span className="flex-1 text-[12px] text-ink-tertiary">Ask anything about China…</span>
      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-white">
        <Mic className="h-3.5 w-3.5" />
      </div>
    </div>
  </div>
);

const PreviewBooking = () => (
  <div className="rounded-3xl bg-white p-4 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.25)]">
    <div className="h-20 rounded-2xl bg-surface-2" />
    <div className="mt-3 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-[14px] font-bold text-ink">No3 Warehouse</div>
        <div className="text-[11px] text-ink-secondary">Modern · The Bund · ¥¥¥</div>
      </div>
      <div className="flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-success">
        <CircleCheck className="h-2.5 w-2.5" /> Booked
      </div>
    </div>
    <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-2 text-[12px] text-ink">
      <CalendarDays className="h-3.5 w-3.5 text-ink" />
      Tomorrow · 7:30pm · Table for 2
    </div>
  </div>
);

const PreviewTransfer = () => (
  <div className="rounded-3xl bg-white p-4 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.25)]">
    <div className="flex h-20 items-center justify-center gap-1 rounded-2xl bg-gradient-to-b from-[#F3D6B1] to-[#2A2A2A]">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-8 w-6 rounded-sm bg-ink/80" style={{ transform: `translateY(${i * 1}px)` }} />
      ))}
    </div>
    <div className="mt-3 flex items-start gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-error-tint text-brand-red">
        <Plane className="h-4 w-4" strokeWidth={2.2} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-bold text-ink">Airport transfer</div>
        <div className="text-[11px] text-ink-secondary">Peninsula → Pudong T2</div>
      </div>
      <div className="text-[13px] font-bold text-ink">¥380</div>
    </div>
    <div className="mt-3 space-y-1.5 rounded-2xl bg-surface-2 px-3 py-2 text-[12px] text-ink">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-success" />
        Fri 24 May · 9:30am pickup
      </div>
      <div className="flex items-center gap-1.5">
        <Car className="h-3 w-3 text-ink" /> Standard sedan · fixed price
      </div>
    </div>
  </div>
);

const PreviewGetAround = () => {
  const tiles: { label: string; Icon: typeof MapIcon }[] = [
    { label: "Maps", Icon: MapIcon },
    { label: "Exchange", Icon: ArrowLeftRight },
    { label: "Translate", Icon: Languages },
    { label: "Guides & more", Icon: BookOpen },
  ];
  return (
    <div className="rounded-3xl bg-white p-4 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.25)]">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map(({ label, Icon }) => (
          <div key={label} className="rounded-2xl bg-surface-2 p-3">
            <Icon className="h-4 w-4 text-ink" strokeWidth={2} />
            <div className="mt-3 text-[13px] font-bold text-ink">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ---------- Slides ----------

const SLIDES: Slide[] = [
  {
    id: "welcome",
    headline: "Your companion for China.",
    subcopy: "Everything you need on the ground, handled for you, in your own language.",
    tint: "linear-gradient(180deg, #FCEDDD 0%, #E9DEF3 100%)",
    preview: <PreviewCompanion />,
  },
  {
    id: "concierge",
    headline: "Ask anything about your China trip.",
    subcopy: "From \u201Chow do I pay?\u201D to booking dinner, get real answers and things done, any time, day or night.",
    tint: "linear-gradient(180deg, #EADDF4 0%, #FCE1DC 100%)",
    preview: <PreviewConcierge />,
  },
  {
    id: "restaurant",
    headline: "The right table, booked for you.",
    subcopy: "Tell us the vibe or name the place, we find it, confirm it, and book it under your name.",
    tint: "linear-gradient(180deg, #FCE1D0 0%, #F7D3C1 100%)",
    preview: <PreviewBooking />,
  },
  {
    id: "transfer",
    headline: "Rides without the guesswork.",
    subcopy: "Private transfers at a fixed, all-in price. No surge, no language barrier, no haggling.",
    tint: "linear-gradient(180deg, #E4E6F4 0%, #DDE7F3 100%)",
    preview: <PreviewTransfer />,
  },
  {
    id: "get-around",
    headline: "Everything you need to get around.",
    subcopy: "Maps, live exchange, instant translation, local guides and more, all in one place.",
    tint: "linear-gradient(180deg, #DFEFE4 0%, #DFE9F3 100%)",
    preview: <PreviewGetAround />,
  },
];

const Welcome = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const [index, setIndex] = useState(0);
  const total = SLIDES.length;
  const isLast = index === total - 1;
  const slide = SLIDES[index];

  // If a signed-in user has already completed the welcome tour on any device,
  // skip straight past it. Also caches it locally so subsequent visits are
  // instant even without a session.
  useEffect(() => {
    if (user && profile?.welcome_completed) {
      markWelcomeCompletedLocal();
      navigate("/", { replace: true });
    }
  }, [user, profile?.welcome_completed, navigate]);

  const finish = async (destination: "/auth" | "/") => {
    markWelcomeCompletedLocal();
    // If the user is already signed in (edge case — most guests are not),
    // persist to the profile too so other devices skip the flow.
    if (user) {
      try {
        await supabase.from("profiles").update({ welcome_completed: true }).eq("user_id", user.id);
        await refreshProfile();
      } catch { /* non-blocking */ }
    }
    navigate(destination, { replace: true });
  };

  const next = () => {
    if (isLast) finish("/auth");
    else setIndex((i) => Math.min(total - 1, i + 1));
  };
  const skip = () => finish("/auth");

  const dots = useMemo(
    () => Array.from({ length: total }, (_, i) => i),
    [total],
  );

  return (
    <div className="min-h-[100dvh] bg-white pt-safe">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[440px] flex-col px-5 pb-safe">
        {/* Pastel preview card */}
        <div
          key={slide.id}
          className="mt-4 rounded-[28px] p-5 pb-6 animate-in fade-in duration-300"
          style={{ background: slide.tint }}
        >
          <div className="flex justify-center pb-4">
            <div className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-ink" strokeWidth={2.2} />
              <Wordmark className="text-[15px]" />
            </div>
          </div>
          {slide.preview}
        </div>

        {/* Copy */}
        <div className="mt-8 flex-1">
          <h1 className="text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink text-balance">
            {slide.headline}
          </h1>
          <p className="mt-3 text-[15px] leading-[1.45] text-ink-secondary">
            {slide.subcopy}
          </p>
        </div>

        {/* Dots */}
        <div className="mb-5 mt-6 flex items-center justify-center gap-1.5" aria-label={`Slide ${index + 1} of ${total}`}>
          {dots.map((i) => {
            const active = i === index;
            return (
              <span
                key={i}
                className={
                  active
                    ? "h-1.5 w-6 rounded-full bg-ink transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-hairline transition-all"
                }
              />
            );
          })}
        </div>

        {/* CTAs */}
        <div className="space-y-2.5 pb-4">
          <button
            type="button"
            onClick={next}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white transition-colors hover:bg-[hsl(240_5%_12%)] active:opacity-90"
          >
            {isLast ? "Create your account" : "Next"}
          </button>
          <button
            type="button"
            onClick={skip}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink transition-colors hover:bg-surface-3"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
};

export default Welcome;