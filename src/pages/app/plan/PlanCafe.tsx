import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { usePlan } from "@/contexts/PlanContext";
import { SHANGHAI_AREA_BY_ID } from "@/data/shanghaiAreas";
import { useWizardStep } from "@/components/plan/wizard/useWizardStep";
import { WizardContinueBar } from "@/components/plan/wizard/WizardContinueBar";
import { VenueCard } from "@/components/plan/wizard/VenueCard";
import { StagedSpinner } from "@/components/plan/wizard/StagedSpinner";
import { useRecommendStops } from "@/components/plan/wizard/useRecommendStops";

const PlanCafe = () => {
  const navigate = useNavigate();
  const { duration, areas, wantBreakfast, cafe, setCafe } = usePlan();
  const { step, total } = useWizardStep("cafe");

  useEffect(() => {
    if (!duration || areas.length === 0 || !wantBreakfast) {
      navigate("/ai/plan", { replace: true });
    }
  }, [duration, areas, wantBreakfast, navigate]);

  const { loading, picks, error, refetch } = useRecommendStops({ slot: "breakfast", count: 3 });
  const areaName = areas[0] ? SHANGHAI_AREA_BY_ID[areas[0]].name : "you";

  const handleContinue = () => {
    if (!cafe) return;
    navigate("/ai/plan/morning");
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Best breakfast near {areaName}
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Tap the one you like — I'll slot it in first.
        </p>

        {loading ? (
          <StagedSpinner label={`Finding cafés near ${areaName}…`} />
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
            <p className="font-display text-[15px] text-ink">Couldn't fetch cafés right now.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
            >
              Try again
            </button>
          </div>
        ) : picks.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
            <p className="font-display text-[15px] text-ink">No cafés in your chosen areas.</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              We only surface places we can vouch for.
            </p>
            <button
              onClick={() => refetch(true)}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
            >
              Look in nearby areas
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {picks.map((v, i) => (
              <VenueCard
                key={v.id}
                venue={v}
                selected={cafe?.id === v.id}
                onToggle={() => setCafe(cafe?.id === v.id ? null : v)}
                topPick={i === 0}
              />
            ))}
          </div>
        )}
      </div>

      <WizardContinueBar onClick={handleContinue} disabled={!cafe} label="Add to my day" />
    </AppLayout>
  );
};

export default PlanCafe;