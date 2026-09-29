import type { RecommendedStop } from "@/contexts/PlanContext";

type Props = {
  venue: RecommendedStop;
  selected: boolean;
  disabled?: boolean;
  onToggle: () => void;
  topPick?: boolean;
};

/** Show the Chinese name only when it exists AND differs from the English
 *  name — avoids "RAC Bar & Coffee RAC" duplication. */
const showZh = (en: string, zh?: string) =>
  !!zh && zh.trim() !== "" && zh.trim().toLowerCase() !== en.trim().toLowerCase();

/** Shared card for recommend-stops results — English + Chinese name, blurb,
 *  the AI's one-line reason, optional "Top pick for you" chip. */
export const VenueCard = ({ venue, selected, disabled, onToggle, topPick }: Props) => {
  const isDisabled = !!disabled && !selected;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      className={
        "relative flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left shadow-soft transition active:scale-[0.99] " +
        (isDisabled ? "opacity-40 " : "") +
        (selected
          ? "border-vermilion bg-card"
          : "border-foreground/10 bg-card hover:border-foreground/30")
      }
      aria-pressed={selected}
    >
      <div className="min-w-0 flex-1">
        <div className="font-display text-base leading-tight text-ink">
          {venue.name}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
        {venue.category && <span>{venue.category}</span>}
          {venue.category && venue.district && <span>·</span>}
          {venue.district && <span className="normal-case tracking-normal">{venue.district}</span>}
          {topPick && (
            <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-ink">
              Top pick for you
            </span>
          )}
        </div>
        {(() => {
          // One description line only. Prefer the AI reason when it adds
          // context beyond the blurb; otherwise fall back to the blurb.
          const blurb = venue.blurb?.trim() ?? "";
          const reason = venue.reason?.trim() ?? "";
          const norm = (s: string) =>
            s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
          const b = norm(blurb);
          const r = norm(reason);
          const overlap = r && b && (r === b || b.includes(r) || r.includes(b));
          const line = reason && !overlap ? reason : blurb;
          return line ? (
            <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
              {line}
            </p>
          ) : null;
        })()}
        <div className="mt-2 text-[11px] text-muted-foreground">
          Suggested ~{venue.durationMinutes} min
        </div>
      </div>
      <span
        className={
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition " +
          (selected
            ? "border-vermilion bg-vermilion"
            : "border-foreground/25 bg-transparent")
        }
        aria-hidden
      >
        {selected && <span className="h-1.5 w-1.5 rounded-full bg-cream" />}
      </span>
    </button>
  );
};