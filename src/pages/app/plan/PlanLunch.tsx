import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Utensils, X } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan, type LunchPrefs } from "@/contexts/PlanContext";
import { useAuth } from "@/contexts/AuthContext";
import { useWizardStep } from "@/components/plan/wizard/useWizardStep";
import { WizardContinueBar } from "@/components/plan/wizard/WizardContinueBar";
import { VenueCard } from "@/components/plan/wizard/VenueCard";
import { StagedSpinner } from "@/components/plan/wizard/StagedSpinner";
import { useRecommendStops } from "@/components/plan/wizard/useRecommendStops";

const CUISINES = ["Shanghainese", "Dumplings", "Noodles", "Western"];
const VIBES = ["Local & casual", "Quiet sit-down", "Views", "Quick bite"];

const budgetToApi = (b: 1 | 2 | 3 | null) =>
  b === 1 ? "budget" : b === 2 ? "mid" : b === 3 ? "fine" : null;

const diningBudgetToNum = (b?: string | null): 1 | 2 | 3 | null =>
  b === "budget" ? 1 : b === "mid" ? 2 : b === "fine" || b === "luxury" ? 3 : null;

type Phase = "prefs" | "picking";

const PlanLunch = () => {
  const navigate = useNavigate();
  const { duration, areas, lunchPrefs, setLunchPrefs, lunch, setLunch } = usePlan();
  const { profile } = useAuth();
  const { step, total } = useWizardStep("lunch");
  const [phase, setPhase] = useState<Phase>("prefs");

  // Prefill budget from profile.dining_budget once, only if user hasn't chosen.
  useEffect(() => {
    if (lunchPrefs.budget === null && profile?.dining_budget) {
      const b = diningBudgetToNum(profile.dining_budget);
      if (b) setLunchPrefs({ ...lunchPrefs, budget: b });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.dining_budget]);

  useEffect(() => {
    if (!duration || areas.length === 0) navigate("/ai/plan", { replace: true });
  }, [duration, areas, navigate]);

  const preferences = useMemo(() => {
    const p: Record<string, unknown> = {};
    if (lunchPrefs.cuisines.length) p.cuisines = lunchPrefs.cuisines;
    if (lunchPrefs.budget) p.budget = budgetToApi(lunchPrefs.budget);
    if (lunchPrefs.vibes.length) p.vibes = lunchPrefs.vibes;
    return p;
  }, [lunchPrefs]);

  const { loading, picks, error, refetch } = useRecommendStops({
    slot: "lunch",
    count: 3,
    preferences,
    enabled: phase === "picking",
  });

  const updatePrefs = (patch: Partial<LunchPrefs>) => setLunchPrefs({ ...lunchPrefs, ...patch });
  const toggleInList = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const handleSkip = () => {
    updatePrefs({ skip: true });
    setLunch(null);
    if (duration === "afternoon" || duration === "full") navigate("/ai/plan/afternoon");
    else navigate("/ai/plan/generating");
  };

  const handleRecommend = () => {
    updatePrefs({ skip: false });
    setPhase("picking");
  };

  const handleAddLunch = () => {
    if (!lunch) return;
    if (duration === "afternoon" || duration === "full") navigate("/ai/plan/afternoon");
    else navigate("/ai/plan/generating");
  };

  if (phase === "picking") {
    return (
      <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
        <div>
          <button
            onClick={() => setPhase("prefs")}
            className="mb-3 text-[12px] text-muted-foreground hover:text-ink"
          >
            ← Adjust preferences
          </button>
          <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
            Lunch picks
          </h1>
          <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
            Tap the one you like.
          </p>

          {loading ? (
            <StagedSpinner label="Finding a lunch spot for you…" />
          ) : error ? (
            <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
              <p className="font-display text-[15px] text-ink">Couldn't fetch lunch spots right now.</p>
              <button
                onClick={() => refetch()}
                className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
              >
                Try again
              </button>
            </div>
          ) : picks.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
              <p className="font-display text-[15px] text-ink">No lunch spots match those filters.</p>
              <button
                onClick={() => refetch(true)}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
              >
                Look in nearby areas
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-2.5">
              {picks.map((v) => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={lunch?.id === v.id}
                  onToggle={() => setLunch(lunch?.id === v.id ? null : v)}
                />
              ))}
            </div>
          )}
        </div>
        <WizardContinueBar onClick={handleAddLunch} disabled={!lunch} label="Add to my day" />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Ready for lunch?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Tell me your taste and I'll recommend a spot nearby.
        </p>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => updatePrefs({ skip: false })}
            className={
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-soft transition " +
              (!lunchPrefs.skip
                ? "border-vermilion bg-card"
                : "border-foreground/10 bg-card hover:border-foreground/30")
            }
          >
            <span
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition " +
                (!lunchPrefs.skip
                  ? "bg-[hsl(var(--error-tint))] text-vermilion"
                  : "bg-muted text-ink")
              }
            >
              <Utensils className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base text-ink">Yes, find a lunch spot</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                I'll match your taste
              </div>
            </div>
            <span
              className={
                "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " +
                (!lunchPrefs.skip ? "border-vermilion bg-vermilion" : "border-foreground/25 bg-transparent")
              }
              aria-hidden
            >
              {!lunchPrefs.skip && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
            </span>
          </button>

          <button
            onClick={handleSkip}
            className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 bg-card px-4 py-3.5 text-left shadow-soft transition hover:border-foreground/30"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-muted text-ink">
              <X className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base text-ink">Skip lunch</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                {duration === "afternoon" ? "Straight to the afternoon" : "Move to the afternoon"}
              </div>
            </div>
          </button>
        </div>

        {!lunchPrefs.skip && (
          <>
            <div className="mt-6">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Cuisine</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {CUISINES.map((c) => {
                  const on = lunchPrefs.cuisines.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => updatePrefs({ cuisines: toggleInList(lunchPrefs.cuisines, c) })}
                      className={
                        "rounded-full px-4 py-2 text-[13px] transition " +
                        (on ? "bg-ink text-cream" : "bg-muted text-muted-foreground hover:bg-foreground/10")
                      }
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Budget</div>
              <div className="mt-2 flex gap-2">
                {[1, 2, 3].map((b) => {
                  const on = lunchPrefs.budget === b;
                  return (
                    <button
                      key={b}
                      onClick={() => updatePrefs({ budget: on ? null : (b as 1 | 2 | 3) })}
                      className={
                        "rounded-full px-5 py-2 text-[13px] transition " +
                        (on ? "bg-ink text-cream" : "bg-muted text-muted-foreground hover:bg-foreground/10")
                      }
                      aria-pressed={on}
                    >
                      {"¥".repeat(b)}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ambience</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {VIBES.map((v) => {
                  const on = lunchPrefs.vibes.includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => updatePrefs({ vibes: toggleInList(lunchPrefs.vibes, v) })}
                      className={
                        "rounded-full px-4 py-2 text-[13px] transition " +
                        (on ? "bg-ink text-cream" : "bg-muted text-muted-foreground hover:bg-foreground/10")
                      }
                    >
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      <WizardContinueBar
        onClick={handleRecommend}
        label="Recommend a lunch spot"
        leadingIcon={<Sparkles className="h-4 w-4" aria-hidden />}
      />
    </AppLayout>
  );
};

export default PlanLunch;