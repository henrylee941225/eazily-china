import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, BookmarkCheck, ChevronRight } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { usePlan, type TimeBudget } from "@/contexts/PlanContext";
import { useCity } from "@/contexts/CityContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const OPTIONS: { value: TimeBudget; primary: string; secondary: string }[] = [
  { value: "2h", primary: "2 hours", secondary: "Quick visit" },
  { value: "4h", primary: "4 hours", secondary: "Half day" },
  { value: "6h", primary: "6 hours", secondary: "Big chunk of day" },
  { value: "full", primary: "Full day", secondary: "9am to evening" },
  { value: "custom", primary: "Custom", secondary: "Pick your hours" },
];

const PlanTime = () => {
  const navigate = useNavigate();
  const { timeBudget, setTimeBudget, customHours, setCustomHours, setPlan, setSavedPlanId } = usePlan();
  const { city, cities, setCityId } = useCity();
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleSelect = (v: TimeBudget) => {
    setTimeBudget(v);
    if (v === "custom" && !customHours) setCustomHours(6);
  };

  return (
    <AppLayout
      title="Plan my day"
      subtitle="Step 1 of 2"
      backTo="/"
      className="pb-44"
    >
      <div>
        <h1 className="font-display text-3xl font-light leading-[1.05] tracking-tight text-ink sm:text-4xl">
          How long do you <span className="italic text-vermilion">have?</span>
        </h1>
        <p className="mt-2 text-[14px] leading-snug text-muted-foreground">
          We'll size your day to fit.
        </p>

        <button
          type="button"
          onClick={() => {
            setPlan(null);
            setSavedPlanId(null);
            navigate("/ai/plan/saved");
          }}
          className="mt-5 flex w-full items-center gap-3 rounded-2xl border border-vermilion/30 bg-vermilion/10 px-4 py-3 text-left shadow-soft transition active:scale-[0.99] hover:bg-vermilion/15"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vermilion text-cream">
            <BookmarkCheck className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[15px] text-ink">My saved plans</span>
            <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
              Open, edit or delete a saved itinerary
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        </button>

        <div className="mt-6 space-y-2.5">
          {OPTIONS.map((o) => {
            const selected = timeBudget === o.value;
            return (
              <button
                key={o.value}
                onClick={() => handleSelect(o.value)}
                className={
                  "group flex w-full items-center gap-3 rounded-2xl border px-5 py-4 text-left shadow-soft transition active:scale-[0.99] " +
                  (selected
                    ? "border-vermilion/40 bg-vermilion/5"
                    : "border-foreground/10 bg-card hover:border-vermilion/40")
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">{o.primary}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    {o.secondary}
                  </div>
                </div>
              </button>
            );
          })}

          {timeBudget === "custom" && (
            <div className="mt-1 rounded-2xl border border-foreground/10 bg-card px-5 py-4 shadow-soft">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base text-ink">Your hours</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                    Drag to set your day length
                  </div>
                </div>
                <div className="font-display text-2xl font-light text-ink">
                  {customHours}
                  <span className="ml-0.5 text-[11px] font-normal text-muted-foreground">h</span>
                </div>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={customHours}
                onChange={(e) => setCustomHours(Number(e.target.value))}
                className="mt-3 w-full accent-vermilion"
              />
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                <span>1h</span>
                <span>12h</span>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="mt-8 flex w-full items-center justify-center gap-1.5 rounded-full bg-transparent px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/5"
          aria-label={`Planning for ${city.name}. Tap to change city.`}
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          Planning for: {city.name}. Tap to change.
        </button>
      </div>

      <div
        className="fixed inset-x-0 z-40 border-t border-foreground/10 bg-[#F7F7F5]/90 px-5 py-4 backdrop-blur-xl"
        style={{ bottom: "calc(64px + env(safe-area-inset-bottom))" }}
      >
        <button
          onClick={() => navigate("/ai/plan/mood")}
          disabled={!timeBudget}
          className="flex h-[52px] w-full items-center justify-center rounded-full bg-vermilion text-base font-medium text-cream shadow-glow transition disabled:opacity-50"
        >
          Continue
        </button>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-md rounded-3xl border-foreground/10 bg-card p-0 sm:rounded-3xl">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle className="font-serif text-[20px] text-ink">
              Plan for which city?
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-1 overflow-y-auto px-3 py-4">
            {cities.map((c) => {
              const active = c.id === city.id;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    setCityId(c.id);
                    setPickerOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-[15px] transition-colors ${
                    active
                      ? "bg-vermilion text-cream"
                      : "bg-transparent text-ink hover:bg-foreground/5"
                  }`}
                >
                  <span className="font-medium">{c.name}</span>
                  <span className={active ? "text-cream/80" : "text-muted-foreground"}>
                    {c.nameZh}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default PlanTime;