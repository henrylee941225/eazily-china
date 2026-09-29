import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan } from "@/contexts/PlanContext";
import { useCity } from "@/contexts/CityContext";
import { planLog, planError } from "@/lib/planLogger";
import { assembleWizardPlan } from "@/lib/planAssembly";

const PlanGenerating = () => {
  const navigate = useNavigate();
  const {
    duration, areas, cafe, morningActivities, lunch, afternoonActivities, setPlan,
  } = usePlan();
  const { city } = useCity();
  const [stage, setStage] = useState(0);
  const startedRef = useRef(false);

  const stages = [
    `Building your day in ${city.name}…`,
    "Sequencing your stops…",
    "Estimating walk times…",
  ];

  useEffect(() => {
    if (!duration || areas.length === 0) {
      navigate("/ai/plan", { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      planLog("Wizard assembly started");
      try {
        const plan = assembleWizardPlan({
          duration, areas, cafe, morningActivities, lunch, afternoonActivities,
        });
        if (plan.stops.length === 0) throw new Error("empty_plan");
        setStage(1);
        await new Promise((r) => setTimeout(r, 700));
        setStage(2);
        await new Promise((r) => setTimeout(r, 700));
        setPlan(plan);
        planLog(`Assembled ${plan.stops.length} stops`);
        navigate("/ai/plan/result", { replace: true });
      } catch (err) {
        planError("Assembly failed:", err instanceof Error ? err.message : err);
        navigate("/ai/plan/error", { replace: true });
      }
    })();
  }, [duration, areas, cafe, morningActivities, lunch, afternoonActivities, setPlan, navigate]);

  return (
    <AppLayout title="Plan my day" subtitle="Building your day" showBack={false} hideTabBar>
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-card text-vermilion shadow-soft">
          <Sparkles
            className="h-7 w-7"
            style={{ animation: "spin 4s linear infinite" }}
            strokeWidth={1.7}
            aria-hidden
          />
        </div>
        <p
          className="mt-6 font-display text-2xl font-light leading-snug tracking-tight text-ink"
          role="status"
          aria-live="polite"
        >
          {stages[stage]}
        </p>
        <p className="mt-3 text-[13px] text-muted-foreground">
          Almost ready. Please don't refresh.
        </p>
      </div>
    </AppLayout>
  );
};

export default PlanGenerating;