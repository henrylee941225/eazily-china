import { usePlan } from "@/contexts/PlanContext";

export type WizardStepKind =
  | "duration"
  | "areas"
  | "breakfast"
  | "cafe"
  | "morning"
  | "lunch"
  | "afternoon";

/** Dynamic step numbering — the flow shortens when the user picks morning-only
 *  or afternoon-only, or skips breakfast. All pages call this so the "N of M"
 *  header stays consistent. */
export const useWizardStep = (kind: WizardStepKind): { step: number; total: number } => {
  const { duration, wantBreakfast } = usePlan();
  const cafeCount = wantBreakfast ? 1 : 0;

  let sequence: WizardStepKind[];
  if (duration === "morning") {
    sequence = ["duration", "areas", "breakfast", ...(cafeCount ? ["cafe" as const] : []), "morning"];
  } else if (duration === "afternoon") {
    sequence = ["duration", "areas", "lunch", "afternoon"];
  } else {
    sequence = ["duration", "areas", "breakfast", ...(cafeCount ? ["cafe" as const] : []), "morning", "lunch", "afternoon"];
  }

  const total = sequence.length;
  const idx = sequence.indexOf(kind);
  const step = idx === -1 ? 1 : idx + 1;
  return { step, total };
};