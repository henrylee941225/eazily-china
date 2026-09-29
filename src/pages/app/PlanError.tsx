import { useNavigate } from "react-router-dom";
import { AlertCircle } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan } from "@/contexts/PlanContext";

const PlanError = () => {
  const navigate = useNavigate();
  const { timeBudget, mood, setPlan, setTimeBudget, setMood } = usePlan();

  const tryAgain = () => {
    if (!timeBudget || !mood) {
      navigate("/ai/plan", { replace: true });
      return;
    }
    navigate("/ai/plan/generating", { replace: true });
  };

  const startOver = () => {
    setPlan(null);
    setTimeBudget(null);
    setMood(null);
    navigate("/ai/plan");
  };

  return (
    <AppLayout title="Plan my day" backTo="/ai/plan">
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-vermilion shadow-soft">
          <AlertCircle className="h-6 w-6" strokeWidth={1.7} />
        </div>
        <h1 className="mt-5 font-display text-3xl font-light leading-[1.05] tracking-tight text-ink">
          Something <span className="italic text-vermilion">went wrong.</span>
        </h1>
        <p className="mt-2 max-w-[280px] text-[14px] text-muted-foreground">
          We couldn't build your plan right now. Mind trying again?
        </p>
        <div className="mt-8 w-full max-w-[280px] space-y-2">
          <button
            onClick={tryAgain}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-vermilion text-base font-medium text-cream shadow-glow"
          >
            Try again
          </button>
          <button
            onClick={startOver}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-transparent text-base text-muted-foreground"
          >
            Start over
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

export default PlanError;