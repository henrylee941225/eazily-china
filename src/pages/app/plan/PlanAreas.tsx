import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan } from "@/contexts/PlanContext";
import { SHANGHAI_AREAS, type ShanghaiAreaId } from "@/data/shanghaiAreas";
import { useWizardStep } from "@/components/plan/wizard/useWizardStep";
import { WizardContinueBar } from "@/components/plan/wizard/WizardContinueBar";

const MAX_AREAS = 2;

const PlanAreas = () => {
  const navigate = useNavigate();
  const { duration, areas, setAreas } = usePlan();
  const { step, total } = useWizardStep("areas");

  useEffect(() => {
    if (!duration) navigate("/ai/plan", { replace: true });
  }, [duration, navigate]);

  const toggle = (id: ShanghaiAreaId) => {
    if (areas.includes(id)) setAreas(areas.filter((a) => a !== id));
    else if (areas.length < MAX_AREAS) setAreas([...areas, id]);
  };

  const handleContinue = () => {
    if (areas.length === 0) return;
    if (duration === "afternoon") navigate("/ai/plan/lunch");
    else navigate("/ai/plan/breakfast");
  };

  return (
    <AppLayout title="Plan my day" subtitle={`${step} of ${total}`} hideTabBar className="pb-32">
      <div>
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Which areas would you like to visit?
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          Pick one or two — I'll keep travel between them short.
        </p>

        <div className="mt-6 space-y-2.5">
          {SHANGHAI_AREAS.map((a) => {
            const selected = areas.includes(a.id);
            const atCap = !selected && areas.length >= MAX_AREAS;
            return (
              <button
                key={a.id}
                onClick={() => toggle(a.id)}
                disabled={atCap}
                className={
                  "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left shadow-soft transition active:scale-[0.99] disabled:opacity-40 " +
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
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{a.name}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {a.descriptor}
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

        {areas.length >= MAX_AREAS && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Two areas keeps the day walkable.
          </p>
        )}
      </div>

      <WizardContinueBar onClick={handleContinue} disabled={areas.length === 0} />
    </AppLayout>
  );
};

export default PlanAreas;