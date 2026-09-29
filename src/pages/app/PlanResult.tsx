import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Footprints,
  Car,
  Loader2,
  Pencil,
  Check,
  Plus,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  GripVertical,
  MoreHorizontal,
  PartyPopper,
  CircleCheck,
  Circle,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { planLog, planError, formatStopTime } from "@/lib/planLogger";
import { AppLayout } from "@/components/AppLayout";
import {
  usePlan,
  MOOD_TO_API,
  resolveHours,
  type PlanStop,
  type GeneratedPlan,
} from "@/contexts/PlanContext";
import { StopFormDialog } from "@/components/plan/StopFormDialog";
import { AddStopChooser } from "@/components/plan/AddStopChooser";
import { PlanAdjustSheet } from "@/components/plan/PlanAdjustSheet";
import { PlanMenuSheet } from "@/components/plan/PlanMenuSheet";

const WALK_KMH = 4.5;

const pad = (n: number) => n.toString().padStart(2, "0");

const addMinutes = (hhmm: string, mins: number): string => {
  if (!/^\d{1,2}:\d{2}$/.test(hhmm)) return hhmm;
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
};

/** Recompute startTimes along the chain, preserving each stop's own
 *  duration and walkingMinutesToNext. Anchors on the first stop's time. */
const rechainTimes = (stops: PlanStop[]): PlanStop[] => {
  if (stops.length === 0) return stops;
  const anchor = stops[0].startTime;
  const next: PlanStop[] = [];
  let cursor = anchor;
  for (let i = 0; i < stops.length; i += 1) {
    const s = stops[i];
    next.push({ ...s, startTime: cursor });
    cursor = addMinutes(cursor, s.durationMinutes + (s.walkingMinutesToNext ?? 0));
  }
  return next;
};

const formatDuration = (mins: number): string => {
  if (mins < 60) return `${mins} min`;
  const hrs = mins / 60;
  if (Number.isInteger(hrs)) return hrs === 1 ? "~1 hr" : `~${hrs} hrs`;
  const rounded = Math.round(hrs * 2) / 2;
  return rounded === 1 ? "~1 hr" : `~${rounded} hrs`;
};

/** Split a stored placeName that may be "English 中文" into its two parts,
 *  so we can render Chinese as a lighter secondary label. */
const splitPlaceName = (raw: string): { name: string; zh?: string } => {
  const m = raw.match(/^(.+?)\s+([\u3400-\u9FFF\u3000-\u303F][\u3400-\u9FFF\u3000-\u303F·]*)$/);
  if (m) return { name: m[1].trim(), zh: m[2].trim() };
  return { name: raw };
};

const recomputeSummary = (stops: PlanStop[], prev: GeneratedPlan): GeneratedPlan => {
  const totalMinutes = stops.reduce(
    (sum, s, i) =>
      sum + s.durationMinutes + (i < stops.length - 1 ? s.walkingMinutesToNext : 0),
    0,
  );
  const walkMinutes = stops.reduce(
    (sum, s, i) => sum + (i < stops.length - 1 ? s.walkingMinutesToNext : 0),
    0,
  );
  return {
    ...prev,
    stops,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalDistanceKm: Math.round((walkMinutes / 60) * WALK_KMH * 10) / 10,
  };
};

type Transition = { kind: "nearby" | "walk" | "taxi"; minutes: number };

const transitionFor = (walkMins: number): Transition => {
  if (walkMins <= 2) return { kind: "nearby", minutes: 0 };
  if (walkMins <= 20) return { kind: "walk", minutes: walkMins };
  // Rough car estimate from a walking-minute number: assume ~3× faster.
  return { kind: "taxi", minutes: Math.max(4, Math.round(walkMins / 3)) };
};

const TransitionRow = ({ walkMins }: { walkMins: number }) => {
  const t = transitionFor(walkMins);
  const Icon = t.kind === "taxi" ? Car : Footprints;
  const label =
    t.kind === "nearby"
      ? "nearby"
      : t.kind === "walk"
      ? `${t.minutes} min walk`
      : `taxi · ~${t.minutes} min`;
  return (
    <div className="flex items-center gap-1.5 py-2 pl-[52px] text-[12px] text-ink-secondary">
      <Icon className="h-3.5 w-3.5" aria-hidden />
      <span>{label}</span>
    </div>
  );
};

const PlanResult = () => {
  const navigate = useNavigate();
  const { plan, setPlan, timeBudget, customHours, mood, duration, savedPlanId, setSavedPlanId } =
    usePlan();
  const { city } = useCity();
  const [editing, setEditing] = useState(false);
  const [swappingIndex, setSwappingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [shownAlternatives, setShownAlternatives] = useState<Record<number, string[]>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [manualAddOpen, setManualAddOpen] = useState(false);
  const [aiAdding, setAiAdding] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adjustSummary, setAdjustSummary] = useState<string | null>(null);
  const [priorPlan, setPriorPlan] = useState<GeneratedPlan | null>(null);

  const isSaved = !!savedPlanId;
  const doneCount = plan?.stops.filter((s) => s.done).length ?? 0;
  const allDone = !!plan && plan.stops.length > 0 && doneCount === plan.stops.length;

  useEffect(() => {
    if (!plan) navigate("/ai/plan", { replace: true });
  }, [plan, navigate]);

  const hours = useMemo(
    () => resolveHours(timeBudget, customHours),
    [timeBudget, customHours],
  );

  if (!plan) return null;

  const stopsCount = plan.stops.length;
  const durationLabel =
    duration === "morning"
      ? "Morning"
      : duration === "afternoon"
      ? "Afternoon"
      : duration === "full"
      ? "Full day"
      : plan.totalHours >= 7
      ? "Full day"
      : `${plan.totalHours}h`;
  const subtitle = `${durationLabel} · ${stopsCount} ${stopsCount === 1 ? "stop" : "stops"} · built around your picks`;
  const savedSubtitle = isSaved
    ? allDone
      ? `Completed · ${stopsCount} of ${stopsCount} done`
      : `Today · ${doneCount} of ${stopsCount} done`
    : subtitle;

  const handleSave = async () => {
    if (!plan || saving) return;
    setSaving(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        toast("Please sign in to save your plan", { duration: 3000 });
        return;
      }
      const row = {
        user_id: user.id,
        title: plan.title,
        city: city.name,
        mood: mood ?? null,
        time_budget_hours: hours,
        plan: plan as unknown as any,
      };
      if (savedPlanId) {
        const { error } = await supabase
          .from("saved_plans")
          .update(row)
          .eq("id", savedPlanId);
        if (error) throw error;
        toast("Plan updated", { duration: 2000 });
      } else {
        const { data, error } = await supabase
          .from("saved_plans")
          .insert(row)
          .select("id")
          .single();
        if (error) throw error;
        setSavedPlanId(data.id);
        // Navigate to the full-screen confirmation. The plan and new
        // savedPlanId are still in PlanContext, so the confirm screen
        // can show "View my day".
        navigate("/ai/plan/saved-confirm");
        return;
      }
    } catch (e) {
      planError("Save failed:", e);
      toast("Couldn't save plan. Try again?", { duration: 3000 });
    } finally {
      setSaving(false);
    }
  };

  const handleSwap = async (i: number) => {
    if (swappingIndex !== null) return;
    planLog(`Swap triggered for stop ${i + 1}`);
    setSwappingIndex(i);
    try {
      const previously = shownAlternatives[i] ?? [];
      const { data, error } = await supabase.functions.invoke("swap-stop", {
        body: {
          city: city.name,
          timeBudget: hours,
          mood: mood ? MOOD_TO_API[mood] : "culture",
          currentPlan: plan,
          stopIndexToReplace: i,
          previouslyShownAlternatives: previously,
        },
      });
      if (error) throw error;
      if (!data?.stop) throw new Error("no stop");
      const newStop = data.stop as PlanStop;
      const oldName = plan.stops[i].placeName;
      const nextStops = rechainTimes(plan.stops.map((s, idx) => (idx === i ? newStop : s)));
      setPlan(recomputeSummary(nextStops, plan));
      setShownAlternatives((m) => ({
        ...m,
        [i]: Array.from(new Set([...(m[i] ?? []), oldName])),
      }));
      planLog("Swap succeeded");
    } catch (e) {
      planError("Swap failed:", e);
      toast("Couldn't find an alternative. Try again?", { duration: 3000 });
    } finally {
      setSwappingIndex(null);
    }
  };

  const handleRemove = (i: number) => {
    planLog(`Delete confirmed for stop ${i + 1}`);
    const nextStops = rechainTimes(plan.stops.filter((_, idx) => idx !== i));
    setPlan(recomputeSummary(nextStops, plan));
    setShownAlternatives((m) => {
      const next: Record<number, string[]> = {};
      Object.entries(m).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < i) next[ki] = v;
        else if (ki > i) next[ki - 1] = v;
      });
      return next;
    });
  };

  const moveStop = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= plan.stops.length) return;
    const next = [...plan.stops];
    [next[i], next[j]] = [next[j], next[i]];
    setPlan(recomputeSummary(rechainTimes(next), plan));
  };

  const insertStopAtEnd = (stop: PlanStop) => {
    const nextStops = rechainTimes([...plan.stops, stop]);
    setPlan(recomputeSummary(nextStops, plan));
  };

  const handleAiAdd = async () => {
    planLog("AI add-stop requested");
    setAiAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-stop", {
        body: {
          city: city.name,
          timeBudget: hours,
          mood: mood ? MOOD_TO_API[mood] : "culture",
          currentPlan: plan,
          insertAfterIndex: plan.stops.length - 1,
        },
      });
      if (error) throw error;
      if (!data?.stop) throw new Error("no stop");
      insertStopAtEnd(data.stop as PlanStop);
      planLog("AI add-stop succeeded");
      setAddOpen(false);
    } catch (e) {
      planError("AI add-stop failed:", e);
      toast("Couldn't find a stop. Try again?", { duration: 3000 });
    } finally {
      setAiAdding(false);
    }
  };

  const handleManualSubmit = (
    next: Pick<PlanStop, "placeName" | "startTime" | "durationMinutes" | "neighbourhood">,
  ) => {
    planLog("Manual stop added");
    const newStop: PlanStop = {
      ...next,
      reason: "Added by you",
      walkingMinutesToNext: 0,
      isUserEdited: true,
    };
    insertStopAtEnd(newStop);
    setManualAddOpen(false);
    setAddOpen(false);
  };

  /** Persist plan JSONB in-place for a saved plan (used by mark-as-done and
   *  adjust). No-op when the plan hasn't been saved yet. */
  const persistPlan = async (next: GeneratedPlan) => {
    if (!savedPlanId) return;
    const { error } = await supabase
      .from("saved_plans")
      .update({ plan: next as unknown as any })
      .eq("id", savedPlanId);
    if (error) planError("persist plan failed:", error);
  };

  const toggleDone = (i: number) => {
    const nextStops = plan.stops.map((s, idx) => (idx === i ? { ...s, done: !s.done } : s));
    const next: GeneratedPlan = { ...plan, stops: nextStops };
    setPlan(next);
    void persistPlan(next);
  };

  const applyAdjustment = (next: GeneratedPlan, summary: string, previous: GeneratedPlan) => {
    setPriorPlan(previous);
    setAdjustSummary(summary);
    setPlan(next);
    void persistPlan(next);
  };

  const undoAdjustment = () => {
    if (!priorPlan) return;
    setPlan(priorPlan);
    void persistPlan(priorPlan);
    setAdjustSummary(null);
    setPriorPlan(null);
  };

  const handleShare = async () => {
    const lines = [plan.title, ""];
    for (const s of plan.stops) {
      lines.push(`${formatStopTime(s.startTime)} · ${s.placeName}`);
      if (s.neighbourhood) lines.push(`  ${s.neighbourhood}`);
    }
    const text = lines.join("\n");
    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        await (navigator as unknown as { share: (d: ShareData) => Promise<void> }).share({
          title: plan.title,
          text,
        });
      } else if (typeof navigator !== "undefined" && (navigator as Navigator).clipboard) {
        await (navigator as Navigator).clipboard.writeText(text);
        toast("Copied to clipboard", { duration: 2000 });
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleDelete = async () => {
    if (!savedPlanId) return;
    const id = savedPlanId;
    const { error } = await supabase.from("saved_plans").delete().eq("id", id);
    if (error) {
      toast("Couldn't delete plan", { duration: 3000 });
      return;
    }
    setSavedPlanId(null);
    toast("Plan deleted", { duration: 2000 });
    navigate("/", { replace: true });
  };

  return (
    <AppLayout
      title={plan.title}
      subtitle={savedSubtitle}
      backTo="/ai/plan"
      hideTabBar
      className="pb-32"
      headerRight={
        isSaved ? (
          <button
            onClick={() => (editing ? setEditing(false) : setMenuOpen(true))}
            aria-label={editing ? "Done editing" : "More options"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
          >
            {editing ? <Check className="h-5 w-5" strokeWidth={2} /> : <MoreHorizontal className="h-5 w-5" strokeWidth={2} />}
          </button>
        ) : (
          <button
            onClick={() => setEditing((v) => !v)}
            aria-label={editing ? "Done editing" : "Edit day"}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
          >
            {editing ? <Check className="h-5 w-5" strokeWidth={2} /> : <Pencil className="h-5 w-5" strokeWidth={2} />}
          </button>
        )
      }
    >
      {/* Adjust summary banner (post-adjust, with Undo) */}
      {adjustSummary && (
        <div className="mb-3 flex items-start gap-3 rounded-2xl bg-[hsl(var(--tint-warm))] p-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-orange))]" strokeWidth={2} fill="currentColor" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-ink">{adjustSummary}</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => { setAdjustSummary(null); setPriorPlan(null); }}
                className="rounded-full bg-ink px-3 py-1.5 text-[12px] font-semibold text-white"
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={undoAdjustment}
                className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-ink border border-border"
              >
                Undo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Day complete state — replaces the timeline */}
      {isSaved && allDone ? (
        <>
          <div className="mt-2 flex items-start gap-3 rounded-2xl bg-[hsl(var(--success-tint))] p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))] text-white">
              <PartyPopper className="h-4 w-4" strokeWidth={2} />
            </span>
            <div>
              <p className="text-[15px] font-bold text-[hsl(var(--success))]">Day complete!</p>
              <p className="mt-0.5 text-[12px] text-ink-secondary">
                You visited all {stopsCount} stops. Nice one.
              </p>
            </div>
          </div>
          <ol className="mt-4 space-y-2">
            {plan.stops.map((stop, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3">
                <CircleCheck className="h-5 w-5 shrink-0 text-[hsl(var(--success))]" strokeWidth={2} />
                <div className="min-w-0 flex-1 text-[14px] text-ink-secondary line-through">
                  {stop.placeName}
                  {stop.neighbourhood && <span className="ml-1 text-ink-tertiary"> · {stop.neighbourhood.split("·")[0].trim()}</span>}
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : stopsCount === 0 ? (
        <div className="mt-10 rounded-2xl bg-surface-2 p-6 text-center">
          <div className="text-[17px] font-bold text-ink">Your day is empty</div>
          <p className="mt-2 text-[13px] text-ink-secondary">
            Add a stop to get started.
          </p>
          <button
            onClick={() => setAddOpen(true)}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-ink px-6 text-[14px] font-medium text-cream"
          >
            Add a stop
          </button>
        </div>
      ) : editing ? (
        <ol className="mt-2 space-y-2">
          {plan.stops.map((stop, i) => {
            const parts = splitPlaceName(stop.placeName);
            const isSwapping = swappingIndex === i;
            return (
              <li
                key={i}
                className="flex items-center gap-2 rounded-2xl bg-surface-2 px-3 py-3"
              >
                <span className="flex h-8 w-6 shrink-0 items-center justify-center text-ink-tertiary">
                  <GripVertical className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink">
                    {parts.name}
                    {parts.zh && (
                      <span className="ml-1.5 text-ink-secondary">{parts.zh}</span>
                    )}
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-ink-secondary">
                    {formatStopTime(stop.startTime)} · {formatDuration(stop.durationMinutes)}
                  </div>
                </div>
                <div className="flex shrink-0 items-center">
                  <button
                    type="button"
                    onClick={() => moveStop(i, -1)}
                    disabled={i === 0}
                    aria-label="Move up"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-3 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveStop(i, 1)}
                    disabled={i === stopsCount - 1}
                    aria-label="Move down"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-3 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwap(i)}
                    disabled={isSwapping}
                    aria-label="Swap this stop"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-ink transition-colors hover:bg-surface-3 disabled:opacity-40"
                  >
                    {isSwapping ? (
                      <Loader2 className="h-4 w-4 animate-spin text-vermilion" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(i)}
                    aria-label="Remove stop"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-brand-red transition-colors hover:bg-error-tint"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border py-3.5 text-[14px] font-medium text-ink-secondary transition-colors hover:bg-surface-2"
            >
              <Plus className="h-4 w-4" />
              Add a stop
            </button>
          </li>
        </ol>
      ) : (
        <ol className="mt-2">
          {plan.stops.map((stop, i) => {
            const isLast = i === stopsCount - 1;
            const parts = splitPlaceName(stop.placeName);
            const isSwapping = swappingIndex === i;
            const isDone = !!stop.done;
            const isNext = isSaved && !isDone && plan.stops.slice(0, i).every((s) => s.done);
            return (
              <li key={i}>
                {/* Time label */}
                <div className="relative flex items-center pl-[52px]">
                  {/* Timeline column: line + dot */}
                  <span
                    className="absolute left-[19px] top-0 h-full w-px bg-border"
                    aria-hidden
                  />
                  <span
                    className={`absolute left-[13px] top-1/2 h-3 w-3 -translate-y-1/2 rounded-full ${
                      isDone ? "bg-[hsl(var(--success))]" : "bg-brand-red"
                    }`}
                    aria-hidden
                  />
                  <div className={`py-1 text-[13px] font-semibold ${isDone ? "text-[hsl(var(--success))]" : "text-brand-red"}`}>
                    {formatStopTime(stop.startTime)}
                    {isSaved && isDone && <span className="ml-1 font-medium text-ink-secondary">· Done</span>}
                    {isSaved && isNext && <span className="ml-1 font-medium text-brand-red">· Now</span>}
                  </div>
                </div>

                {/* Card row */}
                <div className="relative pl-[52px]">
                  <span
                    className={`absolute left-[19px] top-0 w-px bg-border ${
                      isLast ? "h-4" : "h-full"
                    }`}
                    aria-hidden
                  />
                  <div
                    className={`relative rounded-2xl px-4 py-3.5 ${
                      isSaved && isNext ? "bg-white ring-2 ring-brand-red" : "bg-surface-2"
                    }`}
                  >
                    <div className={`text-[15px] font-semibold ${isDone ? "text-ink-tertiary line-through" : "text-ink"}`}>
                      {parts.name}
                      {parts.zh && (
                        <span className={`ml-1.5 font-normal ${isDone ? "text-ink-tertiary" : "text-ink-secondary"}`}>
                          {parts.zh}
                        </span>
                      )}
                    </div>
                    <div className={`mt-1 text-[13px] ${isDone ? "text-ink-tertiary line-through" : "text-ink-secondary"}`}>
                      {[stop.neighbourhood, formatDuration(stop.durationMinutes)]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                    {isSaved && (
                      <button
                        type="button"
                        onClick={() => toggleDone(i)}
                        className={`mt-3 flex w-full items-center justify-center gap-2 rounded-full py-2 text-[13px] font-semibold transition-colors ${
                          isDone
                            ? "bg-surface-3 text-ink-secondary hover:bg-border"
                            : "bg-[hsl(var(--tint-warm))] text-[hsl(var(--brand-orange))] hover:bg-[hsl(var(--brand-orange)/0.16)]"
                        }`}
                      >
                        {isDone ? <Circle className="h-4 w-4" strokeWidth={2} /> : <CircleCheck className="h-4 w-4" strokeWidth={2} />}
                        {isDone ? "Undo done" : "Mark as done"}
                      </button>
                    )}
                    {isSwapping && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface-2/85">
                        <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
                          <Loader2 className="h-4 w-4 animate-spin text-vermilion" />
                          Finding alternative…
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Transition */}
                {!isLast && (
                  <div className="relative">
                    <span
                      className="absolute left-[19px] top-0 h-full w-px bg-border"
                      aria-hidden
                    />
                    <TransitionRow walkMins={stop.walkingMinutesToNext ?? 0} />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Bottom action bar */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex w-full max-w-[440px] items-center gap-3 px-4 pt-3">
          {isSaved && allDone ? (
            <button
              onClick={() => {
                setSavedPlanId(null);
                setPlan(null);
                navigate("/ai/plan");
              }}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white"
            >
              <Sparkles className="h-4 w-4 text-[hsl(var(--brand-orange))]" fill="currentColor" strokeWidth={2} />
              Plan another day
            </button>
          ) : (
          <>
          <button
            type="button"
            aria-label="Adjust with AI"
            onClick={() => setAdjustOpen(true)}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-white text-vermilion transition-colors hover:bg-surface-2"
          >
            <Sparkles className="h-5 w-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={saving || stopsCount === 0}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-cream transition-opacity disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : savedPlanId ? (
              <BookmarkCheck className="h-4 w-4" />
            ) : (
              <Bookmark className="h-4 w-4" />
            )}
            {savedPlanId ? "Saved" : "Save this day"}
          </button>
          </>
          )}
        </div>
      </div>

      <AddStopChooser
        open={addOpen && !manualAddOpen}
        loading={aiAdding}
        onClose={() => {
          if (aiAdding) return;
          setAddOpen(false);
        }}
        onAiSuggest={handleAiAdd}
        onManual={() => setManualAddOpen(true)}
      />

      <StopFormDialog
        open={manualAddOpen}
        mode="add"
        onClose={() => {
          setManualAddOpen(false);
          setAddOpen(false);
        }}
        onSubmit={handleManualSubmit}
      />

      <PlanAdjustSheet
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        plan={plan}
        onApply={applyAdjustment}
      />

      <PlanMenuSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        onEdit={() => setEditing(true)}
        onShare={handleShare}
        onDelete={() => setConfirmDelete(true)}
      />

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6">
          <div className="w-full max-w-[360px] rounded-2xl bg-white p-5 text-center shadow-xl">
            <p className="text-[15px] font-bold text-ink">Delete this day?</p>
            <p className="mt-1 text-[12px] text-ink-secondary">This can't be undone.</p>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-full bg-surface-2 py-2.5 text-[14px] font-semibold text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { setConfirmDelete(false); void handleDelete(); }}
                className="flex-1 rounded-full bg-[hsl(var(--brand-red))] py-2.5 text-[14px] font-semibold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default PlanResult;