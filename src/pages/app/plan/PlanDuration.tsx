import { useNavigate } from "react-router-dom";
import { Sunrise, Sun, SunMedium } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan, type WizardDuration } from "@/contexts/PlanContext";
import { useWizardStep } from "@/components/plan/wizard/useWizardStep";
import { WizardContinueBar } from "@/components/plan/wizard/WizardContinueBar";

const OPTIONS: {
  value: WizardDuration;
  primary: string;
  secondary: string;
  icon: typeof Sunrise;
}[] = [
  { value: "morning", primary: "Morning only", secondary: "Breakfast + a couple of stops", icon: Sunrise },
  { value: "afternoon", primary: "Afternoon only", secondary: "Lunch onward", icon: Sun },
  { value: "full", primary: "Full day", secondary: "Breakfast to evening", icon: SunMedium },
];

const durationToTimeBudget = (d: WizardDuration) => (d === "full" ? "full" : "4h");

const PlanDuration = () => {
  const navigate = useNavigate();
  const { duration, setDuration, setTimeBudget } = usePlan();
  const { step, total } = useWizardStep("duration");

  const handleSelect = (v: WizardDuration) => {
    setDuration(v);
    setTimeBudget(durationToTimeBudget(v));
  };

  const handleContinue = () => {
    if (!duration) return;
    navigate("/ai/plan/areas");
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} backTo="/" hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          How long do you have?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Morning only, afternoon only, or make a full day of it.
        </p>

        <div className="mt-6 space-y-2.5">
          {OPTIONS.map((o) => {
            const selected = duration === o.value;
            const Icon = o.icon;
            return (
              <button
                key={o.value}
                onClick={() => handleSelect(o.value)}
                className={
                  "group flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left shadow-soft transition active:scale-[0.99] " +
                  (selected
                    ? "border-vermilion bg-card"
                    : "border-foreground/10 bg-card hover:border-foreground/30")
                }
              >
                <span
                  className={
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] transition " +
                    (selected
                      ? "bg-[hsl(var(--error-tint))] text-vermilion"
                      : "bg-muted text-ink")
                  }
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{o.primary}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {o.secondary}
                  </div>
                </div>
                <span
                  className={
                    "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " +
                    (selected ? "border-vermilion bg-vermilion" : "border-foreground/25 bg-transparent")
                  }
                  aria-hidden
                >
                  {selected && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <WizardContinueBar onClick={handleContinue} disabled={!duration} />
    </AppLayout>
  );
};

export default PlanDuration;