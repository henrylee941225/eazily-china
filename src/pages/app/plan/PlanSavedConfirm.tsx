import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { usePlan } from "@/contexts/PlanContext";

const PlanSavedConfirm = () => {
  const navigate = useNavigate();
  const { plan, savedPlanId } = usePlan();

  useEffect(() => {
    if (!plan || !savedPlanId) navigate("/", { replace: true });
  }, [plan, savedPlanId, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-ink px-6 text-center text-white">
      <div className="flex flex-col items-center">
        <span
          className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[0_0_60px_hsl(var(--brand-orange)/0.6)]"
          style={{ background: "linear-gradient(180deg, hsl(var(--brand-orange)) 0%, hsl(24 100% 42%) 100%)" }}
          aria-hidden
        >
          <Check className="h-9 w-9" strokeWidth={2.6} />
        </span>
        <h1 className="mt-6 text-[26px] font-extrabold leading-tight">Your day is saved.</h1>
        <p className="mt-3 max-w-[280px] text-[14px] leading-snug text-white/70">
          Find it on your Home hub and in Bookings. I'll remind you before each stop.
        </p>
      </div>

      <div className="mt-10 flex w-full max-w-[320px] flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/ai/plan/result")}
          className="flex h-12 w-full items-center justify-center rounded-full bg-white text-[15px] font-semibold text-ink"
        >
          View my day
        </button>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="text-[14px] font-medium text-white/70 hover:text-white"
        >
          Back to home
        </button>
      </div>
    </div>
  );
};

export default PlanSavedConfirm;