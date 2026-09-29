import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { usePlan, type Mood } from "@/contexts/PlanContext";

const OPTIONS: { value: Mood; emoji: string; primary: string; secondary: string }[] = [
  { value: "foodie", emoji: "🍜", primary: "Foodie", secondary: "Built around meals and markets" },
  { value: "culture", emoji: "🏛", primary: "Culture", secondary: "Museums, monuments, history" },
  { value: "slow", emoji: "🌿", primary: "Slow & local", secondary: "Parks, tea houses, neighbourhoods" },
  { value: "buzzy", emoji: "🌃", primary: "Buzzy", secondary: "Nightlife, vibrant areas, energy" },
  { value: "photo", emoji: "📷", primary: "Photographer's", secondary: "Iconic spots, golden hour" },
];

const PlanMood = () => {
  const navigate = useNavigate();
  const { timeBudget, customHours, mood, setMood } = usePlan();

  useEffect(() => {
    if (!timeBudget) navigate("/ai/plan", { replace: true });
  }, [timeBudget, navigate]);

  const handleBuild = () => {
    const resolvedTime = timeBudget === "custom" ? `${customHours}h` : timeBudget;
    console.log("[PLAN] Inputs:", { timeBudget: resolvedTime, mood });
    navigate("/ai/plan/generating");
  };

  return (
    <AppLayout title="Plan my day" subtitle="Step 2 of 2" backTo="/ai/plan" className="pb-44">
      <div>
        <h1 className="font-display text-3xl font-light leading-[1.05] tracking-tight text-ink sm:text-4xl">
          What kind of <span className="italic text-vermilion">day?</span>
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Pick the vibe. We'll match it.
        </p>

        <div className="mt-6 space-y-2.5">
          {OPTIONS.map((o) => {
            const selected = mood === o.value;
            return (
              <button
                key={o.value}
                onClick={() => setMood(o.value)}
                className={
                  "group flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-soft transition active:scale-[0.99] " +
                  (selected
                    ? "border-vermilion/40 bg-vermilion/5"
                    : "border-foreground/10 bg-card hover:border-vermilion/40")
                }
              >
                <div
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg shadow-soft transition " +
                    (selected ? "bg-vermilion/10" : "bg-card")
                  }
                  aria-hidden
                >
                  {o.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{o.primary}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {o.secondary}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="fixed inset-x-0 z-40 border-t border-foreground/10 bg-[#F7F7F5]/90 px-5 py-4 backdrop-blur-xl"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={handleBuild}
          disabled={!mood}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-vermilion text-base font-medium text-cream shadow-glow transition disabled:opacity-50"
        >
          Build my day
        </button>
      </div>
    </AppLayout>
  );
};

export default PlanMood;