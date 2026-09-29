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

const MAX = 2;

const PlanMorning = () => {
  const navigate = useNavigate();
  const { duration, areas, morningActivities, setMorningActivities } = usePlan();
  const { step, total } = useWizardStep("morning");

  useEffect(() => {
    if (!duration || areas.length === 0 || duration === "afternoon") {
      navigate("/ai/plan", { replace: true });
    }
  }, [duration, areas, navigate]);

  const { loading, picks, error, refetch } = useRecommendStops({ slot: "morning", count: 3 });
  const areaName = areas[0] ? SHANGHAI_AREA_BY_ID[areas[0]].name : "you";

  const toggle = (id: string) => {
    if (morningActivities.some((v) => v.id === id)) {
      setMorningActivities(morningActivities.filter((v) => v.id !== id));
    } else if (morningActivities.length < MAX) {
      const v = picks.find((p) => p.id === id);
      if (v) setMorningActivities([...morningActivities, v]);
    }
  };

  const handleContinue = () => {
    if (morningActivities.length === 0) return;
    if (duration === "morning") navigate("/ai/plan/generating");
    else navigate("/ai/plan/lunch");
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          After breakfast, what next?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Near {areaName} — pick up to {MAX} places to add to your morning.
        </p>

        {loading ? (
          <StagedSpinner label={`Finding things to do near ${areaName}…`} />
        ) : error ? (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
            <p className="font-display text-[15px] text-ink">Couldn't fetch suggestions right now.</p>
            <button
              onClick={() => refetch()}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
            >
              Try again
            </button>
          </div>
        ) : picks.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
            <p className="font-display text-[15px] text-ink">Nothing to visit in your chosen areas yet.</p>
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
            {picks.map((v) => {
              const selected = morningActivities.some((s) => s.id === v.id);
              return (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={selected}
                  disabled={!selected && morningActivities.length >= MAX}
                  onToggle={() => toggle(v.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <WizardContinueBar
        onClick={handleContinue}
        disabled={morningActivities.length === 0}
        label="Add to my day"
      />
    </AppLayout>
  );
};

export default PlanMorning;