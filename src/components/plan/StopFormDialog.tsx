import { useEffect, useId, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { PlanStop } from "@/contexts/PlanContext";

const DURATION_CHIPS: { label: string; value: number }[] = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "1h 30 min", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "3 hours", value: 180 },
];

type Mode = "edit" | "add";

type Props = {
  open: boolean;
  mode: Mode;
  initial?: Partial<PlanStop>;
  onClose: () => void;
  onSubmit: (s: Pick<PlanStop, "placeName" | "startTime" | "durationMinutes" | "neighbourhood">) => void;
};

export const StopFormDialog = ({ open, mode, initial, onClose, onSubmit }: Props) => {
  const [placeName, setPlaceName] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [neighbourhood, setNeighbourhood] = useState("");
  const baseId = useId();
  const nameId = `${baseId}-name`;
  const timeId = `${baseId}-time`;
  const durId = `${baseId}-duration`;
  const areaId = `${baseId}-area`;

  useEffect(() => {
    if (!open) return;
    setPlaceName(initial?.placeName ?? "");
    setStartTime(initial?.startTime ?? "10:00");
    setDurationMinutes(initial?.durationMinutes ?? 60);
    setNeighbourhood(initial?.neighbourhood ?? "");
  }, [open, initial]);

  const canSubmit = placeName.trim().length > 0 && /^\d{1,2}:\d{2}$/.test(startTime);
  const title = mode === "edit" ? "Edit stop" : "Add a stop";
  const submitLabel = mode === "edit" ? "Save changes" : "Add to plan";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md gap-0 rounded-3xl border-foreground/10 bg-card p-0 sm:rounded-3xl">
        <div className="flex items-center justify-between px-5 pt-5">
          <DialogTitle className="font-serif text-[20px] font-normal text-ink">
            {title}
          </DialogTitle>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label htmlFor={nameId} className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Name
            </label>
            <input
              id={nameId}
              value={placeName}
              onChange={(e) => setPlaceName(e.target.value)}
              placeholder="Place name"
              className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-[15px] text-ink outline-none focus:border-vermilion"
            />
          </div>

          <div>
            <label htmlFor={timeId} className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Start time
            </label>
            <input
              id={timeId}
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-[15px] text-ink outline-none focus:border-vermilion"
            />
          </div>

          <div role="group" aria-labelledby={durId}>
            <div id={durId} className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Duration
            </div>
            <div className="flex flex-wrap gap-2">
              {DURATION_CHIPS.map((c) => {
                const active = durationMinutes === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setDurationMinutes(c.value)}
                    className={`rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                      active
                        ? "border-vermilion bg-vermilion text-cream"
                        : "border-foreground/15 bg-background text-ink hover:bg-foreground/5"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor={areaId} className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Area <span className="font-normal normal-case tracking-normal text-muted-foreground/70">(optional)</span>
            </label>
            <input
              id={areaId}
              value={neighbourhood}
              onChange={(e) => setNeighbourhood(e.target.value)}
              placeholder="Neighbourhood"
              className="w-full rounded-xl border border-foreground/10 bg-background px-3 py-2.5 text-[15px] text-ink outline-none focus:border-vermilion"
            />
          </div>
        </div>

        <div className="space-y-2 border-t border-border px-5 py-4">
          <button
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({
                placeName: placeName.trim(),
                startTime,
                durationMinutes,
                neighbourhood: neighbourhood.trim(),
              })
            }
            className="flex h-11 w-full items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground shadow-soft disabled:opacity-50"
          >
            {submitLabel}
          </button>
          <button
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center rounded-full bg-transparent text-sm text-muted-foreground"
          >
            Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};