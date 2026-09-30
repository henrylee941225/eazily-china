import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type Blocker = { taskId: string; label: string; reason: string };

const CLEARED = [
  "Your profile, trip dates and travel preferences",
  "Every concierge conversation and message",
  "Your bookings and requests",
  "Saved plans",
  "Notification settings and any queued emails",
];

const DeleteAccount = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [blockers, setBlockers] = useState<Blocker[]>([]);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const check = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "GET",
      });
      if (error) throw error;
      setBlockers((data?.blockers ?? []) as Blocker[]);
    } catch (err) {
      console.error("delete-account check failed", err);
      toast.error("Couldn't check your bookings", { description: "Please try again." });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    void check();
  }, []);

  const onDelete = async () => {
    if (confirm.trim().toUpperCase() !== "DELETE" || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        body: { confirm: "DELETE" },
      });
      if (error) {
        // The function replies 409 with the booking that's in the way.
        const ctx = (error as { context?: Response }).context;
        const payload = ctx ? await ctx.json().catch(() => null) : null;
        if (payload?.blockers) {
          setBlockers(payload.blockers as Blocker[]);
          toast.error("A booking is still open", { description: payload.error });
          return;
        }
        throw new Error(payload?.error ?? error.message);
      }
      if (data?.error) throw new Error(data.error);
      toast.success("Your account has been deleted");
      await signOut();
      navigate("/welcome", { replace: true });
    } catch (err: any) {
      console.error("delete-account failed", err);
      toast.error("Couldn't delete your account", {
        description: String(err?.message ?? "Please try again."),
      });
    } finally {
      setBusy(false);
    }
  };

  const blocked = blockers.length > 0;
  const canSubmit = !blocked && !checking && confirm.trim().toUpperCase() === "DELETE";

  return (
    <AppLayout title="Delete my account" backTo="/account" showBack showLiveActivity={false}>
      <div className="mx-auto max-w-[440px] space-y-6 pb-10">
        <section className="rounded-2xl border border-border bg-white p-5">
          <p className="text-[15px] leading-relaxed text-ink">
            Deleting your account removes it for good. This isn't a pause — you can't sign back in,
            and nothing can be restored.
          </p>
        </section>

        <section className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            What's removed
          </p>
          <ul className="space-y-2 rounded-2xl border border-border bg-white p-4">
            {CLEARED.map((item) => (
              <li key={item} className="text-[15px] leading-relaxed text-ink">
                {item}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            What we have to keep
          </p>
          <div className="rounded-2xl border border-border bg-white p-4">
            <p className="text-[15px] leading-relaxed text-ink">
              Payment records — the amount, date and payment reference for anything you paid for.
              Accounting rules require us to keep these, and our payment provider keeps its own copy
              regardless. We strip your name, email, phone and addresses from them, so what remains
              can't identify you.
            </p>
          </div>
        </section>

        {checking ? (
          <div className="flex items-center justify-center gap-2 py-6 text-[15px] text-ink-secondary">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking your bookings…
          </div>
        ) : blocked ? (
          <section className="space-y-3 rounded-2xl border border-[hsl(var(--brand-red))]/30 bg-[hsl(var(--error-tint,#FBEAE7))] p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-[hsl(var(--brand-red))]" strokeWidth={2} />
              <p className="text-[15px] font-semibold text-ink">
                We can't delete your account yet
              </p>
            </div>
            <p className="text-[15px] leading-relaxed text-ink">
              You have {blockers.length === 1 ? "a booking" : "bookings"} we're still handling.
              Cancel {blockers.length === 1 ? "it" : "them"} first — we never delete an account while
              money is held on your card.
            </p>
            <div className="space-y-2">
              {blockers.map((b) => (
                <button
                  key={b.taskId}
                  type="button"
                  onClick={() => navigate(`/bookings/${b.taskId}`)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 text-left"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {b.label}
                    </span>
                    <span className="mt-0.5 block text-[13px] text-ink-secondary">{b.reason}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" strokeWidth={2} />
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void check()}
              className="w-full rounded-full bg-surface-2 py-3 text-[15px] font-semibold text-ink"
            >
              Check again
            </button>
          </section>
        ) : (
          <section className="space-y-3">
            <label
              htmlFor="confirm-delete"
              className="block px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary"
            >
              Type DELETE to confirm
            </label>
            <input
              id="confirm-delete"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="DELETE"
              className="w-full rounded-[14px] bg-surface-2 px-4 py-4 text-[15px] font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-tertiary"
            />
            <button
              type="button"
              disabled={!canSubmit || busy}
              onClick={() => void onDelete()}
              className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[hsl(var(--brand-red))] text-[15px] font-semibold text-[hsl(var(--brand-red))] transition disabled:opacity-40"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/account")}
              className="h-[52px] w-full rounded-full bg-surface-2 text-[15px] font-semibold text-ink"
            >
              Keep my account
            </button>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default DeleteAccount;
