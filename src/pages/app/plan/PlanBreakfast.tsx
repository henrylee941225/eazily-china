import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Coffee, X, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan } from "@/contexts/PlanContext";
import { SHANGHAI_AREA_BY_ID } from "@/data/shanghaiAreas";
import { useWizardStep } from "@/components/plan/wizard/useWizardStep";
import { WizardContinueBar } from "@/components/plan/wizard/WizardContinueBar";

const PlanBreakfast = () => {
  const navigate = useNavigate();
  const { duration, areas, wantBreakfast, setWantBreakfast, setCafe } = usePlan();
  const { step, total } = useWizardStep("breakfast");

  useEffect(() => {
    if (!duration || areas.length === 0 || duration === "afternoon") {
      navigate("/ai/plan", { replace: true });
    }
  }, [duration, areas, navigate]);

  const areaName = areas[0] ? SHANGHAI_AREA_BY_ID[areas[0]].name : "your area";
  const hint = duration === "full"
    ? "Full day selected — want to begin at a café?"
    : "Morning selected — want to begin at a café?";

  const handleContinue = () => {
    if (wantBreakfast === null) return;
    if (wantBreakfast) navigate("/ai/plan/cafe");
    else {
      setCafe(null);
      navigate("/ai/plan/morning");
    }
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Start with breakfast?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">{hint}</p>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={() => setWantBreakfast(true)}
            className={
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-soft transition active:scale-[0.99] " +
              (wantBreakfast === true
                ? "border-vermilion bg-card"
                : "border-foreground/10 bg-card hover:border-foreground/30")
            }
          >
            <span
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition " +
                (wantBreakfast === true
                  ? "bg-[hsl(var(--error-tint))] text-vermilion"
                  : "bg-muted text-ink")
              }
            >
              <Coffee className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base text-ink">Yes, find me a café</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                I'll suggest the best nearby
              </div>
            </div>
            <span
              className={
                "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " +
                (wantBreakfast === true ? "border-vermilion bg-vermilion" : "border-foreground/25 bg-transparent")
              }
              aria-hidden
            >
              {wantBreakfast === true && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
            </span>
          </button>

          <button
            onClick={() => setWantBreakfast(false)}
            className={
              "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-soft transition active:scale-[0.99] " +
              (wantBreakfast === false
                ? "border-vermilion bg-card"
                : "border-foreground/10 bg-card hover:border-foreground/30")
            }
          >
            <span
              className={
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition " +
                (wantBreakfast === false
                  ? "bg-[hsl(var(--error-tint))] text-vermilion"
                  : "bg-muted text-ink")
              }
            >
              <X className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base text-ink">No breakfast</div>
              <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Skip straight to the day
              </div>
            </div>
            <span
              className={
                "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " +
                (wantBreakfast === false ? "border-vermilion bg-vermilion" : "border-foreground/25 bg-transparent")
              }
              aria-hidden
            >
              {wantBreakfast === false && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
            </span>
          </button>
        </div>

        {wantBreakfast === true && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-muted px-4 py-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ink" aria-hidden />
            <p className="text-[13px] leading-snug text-ink/80">
              I'll pick cafés in or near {areaName} so you don't backtrack.
            </p>
          </div>
        )}
      </div>

      <WizardContinueBar onClick={handleContinue} disabled={wantBreakfast === null} />
    </AppLayout>
  );
};

export default PlanBreakfast;