import { Sparkles } from "lucide-react";

/** Loading state matching the PlanGenerating pattern — spinning sparkle plus a
 *  single honest copy line. Used between wizard steps while recommend-stops
 *  runs. */
export const StagedSpinner = ({ label }: { label: string }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center px-6 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-card text-vermilion shadow-soft">
      <Sparkles
        className="h-6 w-6"
        style={{ animation: "spin 4s linear infinite" }}
        strokeWidth={1.7}
        aria-hidden
      />
    </div>
    <p
      className="mt-5 font-display text-lg font-light leading-snug text-ink"
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  </div>
);