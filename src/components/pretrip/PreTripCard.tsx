import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, MoreHorizontal, RotateCcw, EyeOff, Trash2, CheckCircle2, X, type LucideIcon } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { PRETRIP_TASKS, PRETRIP_TOTAL, pretripDoneCount, isPretripComplete } from "@/data/pretripTasks";

/**
 * Self-contained pre-trip checklist card for the Home screen.
 * Reads state from the auth profile, writes back to Supabase directly,
 * and refreshes the profile so the UI updates without extra plumbing.
 *
 * Only renders when:
 *  - the user is signed in
 *  - already_in_china is not true
 *  - the card isn't dismissed
 *  - the snooze date hasn't been reached
 */
export const PreTripCard = () => {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const done = profile?.pretrip_tasks_done ?? [];
  const doneCount = pretripDoneCount(done);
  const complete = isPretripComplete(done);
  const arrivalDate = profile?.arrival_date ?? null;

  const shouldShow = useMemo(() => {
    if (!user || !profile) return false;
    if (profile.already_in_china === true) return false;
    if (profile.pretrip_dismissed) return false;
    const snoozeUntil = profile.pretrip_hidden_until
      ? new Date(profile.pretrip_hidden_until)
      : null;
    if (snoozeUntil) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (snoozeUntil.getTime() > today.getTime()) return false;
    }
    return true;
  }, [user, profile]);

  if (!shouldShow || !user) return null;

  const updateProfile = async (patch: Record<string, any>) => {
    const { error } = await supabase
      .from("profiles")
      .update(patch as any)
      .eq("user_id", user.id);
    if (error) {
      toast({ title: "Couldn't update", description: error.message, variant: "destructive" });
      return false;
    }
    await refreshProfile();
    return true;
  };

  const reset = async () => {
    setMenuOpen(false);
    const ok = await updateProfile({
      pretrip_tasks_done: [],
      pretrip_hidden_until: null,
      pretrip_dismissed: false,
    });
    if (ok) toast({ title: "Progress reset" });
  };

  const hideUntilTrip = async () => {
    setMenuOpen(false);
    if (!arrivalDate) {
      toast({
        title: "Add your trip dates first",
        description: "We'll hide the checklist until your arrival date.",
      });
      navigate("/profile-setup");
      return;
    }
    const ok = await updateProfile({ pretrip_hidden_until: arrivalDate });
    if (ok) toast({ title: "Hidden until your trip" });
  };

  const removeFromHome = async () => {
    setMenuOpen(false);
    const ok = await updateProfile({ pretrip_dismissed: true });
    if (ok) {
      toast({
        title: "Removed from Home",
        description: "You'll still find it in Account.",
      });
    }
  };

  const dismissCompleted = async () => {
    await updateProfile({ pretrip_dismissed: true });
  };

  return (
    <>
      {complete ? (
        <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--success))]/25 bg-[hsl(var(--success-tint))] px-4 py-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))] text-white">
            <CheckCircle2 className="h-5 w-5" strokeWidth={2} />
          </div>
          <button
            type="button"
            onClick={() => navigate("/pretrip")}
            className="min-w-0 flex-1 text-left"
          >
            <div className="text-[15px] font-semibold text-[hsl(var(--success))]">
              You're all set for China
            </div>
            <div className="mt-0.5 text-[13px] text-ink-secondary">
              All {PRETRIP_TOTAL} pre-trip must-dos done
            </div>
          </button>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={dismissCompleted}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] transition-colors hover:bg-[hsl(var(--success))]/25"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border border-[hsl(var(--border,240_5%_89%))] bg-white px-4 py-3.5">
          <button
            type="button"
            onClick={() => navigate("/pretrip")}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            <ProgressRing done={doneCount} total={PRETRIP_TOTAL} />
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold text-ink">Before you fly</div>
              <div className="mt-0.5 truncate text-[13px] text-ink-secondary">
                {doneCount} of {PRETRIP_TOTAL} must-dos done · finish before you land
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ink-secondary" strokeWidth={2} />
          </button>
          <button
            type="button"
            aria-label="Checklist options"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-2"
          >
            <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      )}

      <Drawer open={menuOpen} onOpenChange={setMenuOpen}>
        <DrawerContent className="border-none">
          <DrawerTitle className="sr-only">Checklist options</DrawerTitle>
          <div className="mx-auto w-full max-w-[440px] px-4 pb-6 pt-2">
            <div className="overflow-hidden rounded-2xl bg-white">
              <MenuRow icon={RotateCcw} label="Reset progress" onClick={reset} />
              <MenuDivider />
              <MenuRow icon={EyeOff} label="Hide until my trip" onClick={hideUntilTrip} />
              <MenuDivider />
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
    </>
  );
};

const MenuDivider = () => <div className="mx-4 h-px bg-[hsl(var(--border,240_5%_89%))]" />;

const MenuRow = ({
  icon: Icon,
  label,
  onClick,
  destructive,
}: {
  icon: LucideIcon;
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

const ProgressRing = ({ done, total }: { done: number; total: number }) => {
  const size = 40;
  const stroke = 3.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? done / total : 0;
  const offset = c * (1 - pct);
  const pctLabel = Math.round(pct * 100);
  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--surface-3))"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="hsl(var(--success))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute text-[10px] font-bold text-[hsl(var(--success))]">
        {pctLabel}%
      </span>
    </div>
  );
};