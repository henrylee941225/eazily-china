import { INTERESTS, type InterestId, isInterestId } from "@/data/interests";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

type Props = {
  value: string[];
  onChange: (next: InterestId[]) => void;
  className?: string;
};

export const InterestsSelector = ({ value, onChange, className }: Props) => {
  const selected = new Set<InterestId>(value.filter(isInterestId));

  const toggle = (id: InterestId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
      {INTERESTS.map(({ id, label, icon: Icon, blurb }) => {
        const active = selected.has(id);
        return (
          <button
            key={id}
            type="button"
            onClick={() => toggle(id)}
            aria-pressed={active}
            className={cn(
              "group relative flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
              active
                ? "border-vermilion bg-vermilion/5 text-ink shadow-soft"
                : "border-foreground/15 bg-card text-ink hover:border-foreground/30"
            )}
          >
            <span
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition",
                active ? "bg-vermilion text-cream" : "bg-muted text-muted-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-1">
                <span className="text-sm font-medium leading-tight">{label}</span>
                {active && <Check className="h-3.5 w-3.5 text-vermilion" />}
              </span>
              <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
                {blurb}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
};
