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

const PlanAfternoon = () => {
  const navigate = useNavigate();
  const { duration, areas, afternoonActivities, setAfternoonActivities } = usePlan();
  const { step, total } = useWizardStep("afternoon");

  useEffect(() => {
    if (!duration || areas.length === 0 || duration === "morning") {
      navigate("/ai/plan", { replace: true });
    }
  }, [duration, areas, navigate]);

  const { loading, picks, error, refetch } = useRecommendStops({ slot: "afternoon", count: 3 });
  const areaName = areas[0] ? SHANGHAI_AREA_BY_ID[areas[0]].name : "you";

  const toggle = (id: string) => {
    if (afternoonActivities.some((v) => v.id === id)) {
      setAfternoonActivities(afternoonActivities.filter((v) => v.id !== id));
    } else if (afternoonActivities.length < MAX) {
      const v = picks.find((p) => p.id === id);
      if (v) setAfternoonActivities([...afternoonActivities, v]);
    }
  };

  const handleContinue = () => {
    if (afternoonActivities.length === 0) return;
    navigate("/ai/plan/generating");
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Round out the afternoon
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Near {areaName} — pick up to {MAX}. I've hidden anything already in your day.
        </p>

        {loading ? (
          <StagedSpinner label={`Finding afternoon stops near ${areaName}…`} />
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
            <p className="font-display text-[15px] text-ink">Nothing more to visit in your chosen areas.</p>
            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                onClick={() => refetch(true)}
                className="inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-cream"
              >
                Look in nearby areas
              </button>
              <button
                onClick={() => navigate("/ai/plan/generating")}
                className="inline-flex h-10 items-center justify-center rounded-full bg-transparent px-5 text-sm text-muted-foreground"
              >
                Finish without an afternoon stop
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-2.5">
            {picks.map((v) => {
              const selected = afternoonActivities.some((s) => s.id === v.id);
              return (
                <VenueCard
                  key={v.id}
                  venue={v}
                  selected={selected}
                  disabled={!selected && afternoonActivities.length >= MAX}
                  onToggle={() => toggle(v.id)}
                />
              );
            })}
          </div>
        )}
      </div>

      <WizardContinueBar
        onClick={handleContinue}
        disabled={afternoonActivities.length === 0}
        label="Build my day"
      />
    </AppLayout>
  );
};

export default PlanAfternoon;