import { Calendar } from "lucide-react";

/**
 * Shared trip date input. Extracted from TripDates.tsx so the Pricing
 * screen's inline date step reuses the exact same control — no second
 * date picker anywhere in the app.
 */
export const TripDateField = ({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) => (
  <div>
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
      {label}
    </p>
    <label className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3 text-[14px] text-ink">
      <Calendar className="h-4 w-4 text-ink-secondary" strokeWidth={1.9} />
      <input
        type="date"
        value={value}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-transparent focus:outline-none"
      />
    </label>
  </div>
);

/** Local calendar day as YYYY-MM-DD (never UTC-shifted). */
export const todayIso = (): string => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
