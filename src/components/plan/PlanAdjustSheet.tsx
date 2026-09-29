import { useEffect, useRef, useState } from "react";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { toast } from "sonner";
import type { GeneratedPlan } from "@/contexts/PlanContext";
import { CITIES } from "@/data/cities";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  plan: GeneratedPlan;
  onApply: (nextPlan: GeneratedPlan, summary: string, previous: GeneratedPlan) => void;
};

const buildCurated = (cityName: string) => {
  const city = CITIES.find((c) => c.name.toLowerCase() === cityName.toLowerCase()) ?? CITIES[0];
  return (city?.picks ?? []).map((p) => ({
    name: p.title,
    name_zh: p.title_zh,
    district: p.district,
    category: p.category,
  }));
};

export const PlanAdjustSheet = ({ open, onOpenChange, plan, onApply }: Props) => {
  const { city } = useCity();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
    else setText("");
  }, [open]);

  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("adjust-plan", {
        body: {
          city: city.name,
          message,
          currentPlan: plan,
          curatedVenues: buildCurated(city.name),
        },
      });
      if (error) throw error;
      if (!data?.plan) throw new Error("no plan");
      onApply(data.plan as GeneratedPlan, String(data.summary ?? "Updated your day."), plan);
      onOpenChange(false);
    } catch (e) {
      console.error("adjust-plan failed:", e);
      toast("Couldn't adjust the plan. Try again?", { duration: 3000 });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto max-w-[440px] rounded-t-3xl border-t border-border bg-white">
        <div className="px-5 pt-2 pb-6">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--brand-orange)/0.12)] text-[hsl(var(--brand-orange))]">
              <Sparkles className="h-4 w-4" strokeWidth={2} fill="currentColor" />
            </span>
            <div>
              <div className="text-[16px] font-bold text-ink">Adjust your day</div>
              <div className="text-[12px] text-ink-secondary">Tell me what to change.</div>
            </div>
          </div>

          <div className="mt-4 flex items-end gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
            <textarea
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Can we start later and skip the museum?"
              rows={2}
              maxLength={500}
              disabled={busy}
              className="flex-1 resize-none bg-transparent text-[14px] leading-snug text-ink placeholder:text-ink-tertiary focus:outline-none"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !text.trim()}
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" strokeWidth={2.4} />}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {[
              "Start an hour later",
              "Add a coffee stop",
              "Skip the museum",
              "Something quieter",
            ].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setText(s)}
                disabled={busy}
                className="rounded-full border border-border bg-white px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default PlanAdjustSheet;