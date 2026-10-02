import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronDown, Check, AlertTriangle, Sparkles, MoreHorizontal, RotateCcw, EyeOff, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  PRETRIP_TASKS,
  PRETRIP_TOTAL,
  isPretripComplete,
  pretripDoneCount,
  type PretripTask,
  type PretripTaskSlug,
} from "@/data/pretripTasks";

const PreTrip = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile, loading } = useAuth();
  const [expanded, setExpanded] = useState<PretripTaskSlug | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [loading, user, navigate]);

  const done = useMemo<Set<PretripTaskSlug>>(
    () => new Set((profile?.pretrip_tasks_done ?? []) as PretripTaskSlug[]),
    [profile?.pretrip_tasks_done],
  );
  const doneCount = pretripDoneCount(profile?.pretrip_tasks_done);
  const complete = isPretripComplete(profile?.pretrip_tasks_done);

  const persist = async (nextArr: PretripTaskSlug[]) => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ pretrip_tasks_done: nextArr } as any)
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Couldn't save", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
  };

  const toggle = async (slug: PretripTaskSlug) => {
    const next = new Set(done);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    await persist(Array.from(next));
  };

  const markAllDone = async () => {
    await persist(PRETRIP_TASKS.map((t) => t.slug));
  };

  const reset = async () => {
    setMenuOpen(false);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({
        pretrip_tasks_done: [],
        pretrip_hidden_until: null,
        pretrip_dismissed: false,
      } as any)
      .eq("user_id", user.id);
    await refreshProfile();
    toast({ title: "Progress reset" });
  };

  const hideUntilTrip = async () => {
    setMenuOpen(false);
    if (!user) return;
    const arrival = profile?.arrival_date ?? null;
    if (!arrival) {
      toast({
        title: "Add your trip dates first",
        description: "We'll hide the checklist until your arrival date.",
      });
      navigate("/profile-setup");
      return;
    }
    await supabase
      .from("profiles")
      .update({ pretrip_hidden_until: arrival } as any)
      .eq("user_id", user.id);
    await refreshProfile();
    toast({ title: "Hidden until your trip" });
    navigate("/");
  };

  const removeFromHome = async () => {
    setMenuOpen(false);
    if (!user) return;
    await supabase
      .from("profiles")
      .update({ pretrip_dismissed: true } as any)
      .eq("user_id", user.id);
    await refreshProfile();
    toast({ title: "Removed from Home", description: "You'll still find it in Account." });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-white">
      {/* Top chrome — back + overflow only */}
      <div className="z-30 shrink-0 bg-white pt-safe">
        <div className="mx-auto flex w-full max-w-[440px] items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Checklist options"
            onClick={() => setMenuOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition-colors hover:bg-surface-3"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      <main className="mx-auto min-h-0 w-full max-w-[440px] flex-1 overflow-y-auto px-4 pb-4">
        {complete ? (
          <CompletedState
            firstName={firstNameFromProfile(profile)}
            onEnter={() => navigate("/")}
          />
        ) : (
          <>
            <h1 className="mt-2 text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
              Before you fly
            </h1>
            <p className="mt-2 text-[15px] leading-[1.45] text-ink-secondary">
              Must-dos so you land ready. Tick them off at your own pace.
            </p>

            <div className="mt-6 flex items-center gap-3">
              <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-[hsl(var(--success))] transition-[width] duration-300"
                  style={{ width: `${(doneCount / PRETRIP_TOTAL) * 100}%` }}
                />
              </div>
              <div className="text-[13px] font-bold text-[hsl(var(--success))]">
                {doneCount} / {PRETRIP_TOTAL}
              </div>
            </div>

            <ul className="mt-5 space-y-2">
              {PRETRIP_TASKS.map((task) => (
                <TaskRow
                  key={task.slug}
                  task={task}
                  done={done.has(task.slug)}
                  expanded={expanded === task.slug}
                  onExpand={() =>
                    setExpanded((cur) => (cur === task.slug ? null : task.slug))
                  }
                  onToggleDone={() => toggle(task.slug)}
                  disabled={saving}
                />
              ))}
            </ul>
          </>
        )}
      </main>

      {!complete && (
        <div
          className="z-30 shrink-0 bg-white pt-3"
          style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto w-full max-w-[440px] border-t border-[hsl(var(--border,240_5%_89%))] px-4 pt-3">
            <button
              type="button"
              onClick={markAllDone}
              disabled={saving || doneCount === PRETRIP_TOTAL}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition-opacity disabled:opacity-40"
            >
              <Check className="h-4 w-4" strokeWidth={2.5} />
              Mark all as done
            </button>
          </div>
        </div>
      )}

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="border-none">
          <DrawerTitle className="sr-only">Checklist options</DrawerTitle>
          <div className="mx-auto w-full max-w-[440px] px-4 pb-6 pt-2">
            <div className="overflow-hidden rounded-2xl bg-white">
              <MenuRow icon={RotateCcw} label="Reset progress" onClick={reset} />
              <div className="mx-4 h-px bg-[hsl(var(--border,240_5%_89%))]" />
              <MenuRow icon={EyeOff} label="Hide until my trip" onClick={hideUntilTrip} />
              <div className="mx-4 h-px bg-[hsl(var(--border,240_5%_89%))]" />
              <MenuRow
                icon={Trash2}
                label="Remove from Home"
                onClick={removeFromHome}
                destructive
              />
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-3 flex h-12 w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink"
            >
              Cancel
            </button>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

const firstNameFromProfile = (profile: any): string => {
  const raw =
    (profile?.full_name as string | undefined)?.trim() ||
    (profile?.display_name as string | undefined)?.trim() ||
    "";
  return raw ? raw.split(" ")[0] : "traveller";
};

const TaskRow = ({
  task,
  done,
  expanded,
  onExpand,
  onToggleDone,
  disabled,
}: {
  task: PretripTask;
  done: boolean;
  expanded: boolean;
  onExpand: () => void;
  onToggleDone: () => void;
  disabled: boolean;
}) => {
  const navigate = useNavigate();
  return (
    <li
      className={`overflow-hidden rounded-2xl border transition-colors ${
        done
          ? "border-transparent bg-surface-2"
          : "border-[hsl(var(--border,240_5%_89%))] bg-white"
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          aria-label={done ? "Mark as not done" : "Mark as done"}
          onClick={onToggleDone}
          disabled={disabled}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            done
              ? "border-[hsl(var(--success))] bg-[hsl(var(--success))] text-white"
              : "border-[hsl(var(--border,240_5%_89%))] bg-white text-transparent"
          }`}
        >
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        </button>
        <button
          type="button"
          onClick={onExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <div className="min-w-0 flex-1">
            <div
              className={`text-[15px] font-semibold leading-tight ${
                done ? "text-ink-secondary line-through" : "text-ink"
              }`}
            >
              {task.title}
            </div>
            {!done && (
              <div className="mt-0.5 truncate text-[13px] text-ink-secondary">
                {task.subtitle}
              </div>
            )}
          </div>
          {!done && (
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-ink-secondary transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              strokeWidth={2}
            />
          )}
        </button>
      </div>

      {expanded && !done && (
        <div className="border-t border-[hsl(var(--border,240_5%_89%))] px-4 pb-5 pt-4">
          <div className="flex items-center gap-3">
            <div
              className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                task.tint === "orange"
                  ? "bg-[hsl(var(--tint-warm))] text-[hsl(var(--brand-orange))]"
                  : "bg-[hsl(0_85%_96%)] text-[hsl(var(--brand-red))]"
              }`}
            >
              <task.icon className="h-5 w-5" strokeWidth={2} />
            </div>
          </div>
          <p className="mt-4 text-[15px] leading-[1.5] text-ink-secondary">
            {task.body}
          </p>

          <div className="mt-5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            How to
          </div>
          <ol className="mt-3 space-y-3">
            {task.steps.map((s) => (
              <li key={s.n} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-[12px] font-bold text-white">
                  {s.n}
                </span>
                <span className="text-[15px] leading-[1.45] text-ink">{s.text}</span>
              </li>
            ))}
          </ol>

          {task.callout && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl bg-[hsl(0_85%_96%)] px-4 py-3">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]"
                strokeWidth={2}
              />
              <div className="text-[13px] leading-[1.45] text-ink">{task.callout}</div>
            </div>
          )}

          {task.ctaHref && (
            <button
              type="button"
              onClick={() => navigate(task.ctaHref!)}
              className="mt-5 flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition-opacity"
            >
              {task.ctaLabel ?? "Open"}
            </button>
          )}

          <button
            type="button"
            onClick={onToggleDone}
            disabled={disabled}
            className={`mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold transition-opacity disabled:opacity-40 ${
              task.ctaHref
                ? "bg-surface-2 text-ink"
                : "bg-ink text-white"
            }`}
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            Mark as done
          </button>
        </div>
      )}
    </li>
  );
};

const CompletedState = ({
  firstName,
  onEnter,
}: {
  firstName: string;
  onEnter: () => void;
}) => (
  <div className="-mx-4 flex min-h-full items-center justify-center bg-white px-6 py-8">
    <div className="mx-auto flex max-w-[360px] flex-col items-center text-center">
      <div
        className="flex h-20 w-20 items-center justify-center rounded-full text-white shadow-[0_20px_60px_-10px_hsl(var(--brand-orange)/0.55)]"
        style={{
          background:
            "linear-gradient(135deg, hsl(var(--brand-orange-from)), hsl(var(--brand-orange-to)))",
        }}
      >
        <Check className="h-9 w-9" strokeWidth={2.5} />
      </div>
      <h1 className="mt-8 text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
        You're all set, {firstName}.
      </h1>
      <p className="mt-3 text-[15px] leading-[1.5] text-ink-secondary">
        Your concierge is ready — anything you need, just ask.
      </p>
      <div className="mt-6 flex w-full items-start gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-orange))]" strokeWidth={2} />
        <div className="text-[13px] leading-[1.45] text-ink-secondary">
          Ask me anything or book a service — I'll handle the rest on the ground.
        </div>
      </div>
      <button
        type="button"
        onClick={onEnter}
        className="mt-6 flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white"
      >
        Enter eazilyChina
      </button>
    </div>
  </div>
);

const MenuRow = ({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium transition-colors hover:bg-surface-2 ${
      destructive ? "text-[hsl(var(--brand-red))]" : "text-ink"
    }`}
  >
    <Icon className="h-5 w-5" strokeWidth={2} />
    <span>{label}</span>
  </button>
);

export default PreTrip;
