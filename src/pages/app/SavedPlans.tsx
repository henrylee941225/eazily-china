import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Trash2, MapPin, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/AppLayout";
import { usePlan, type GeneratedPlan, type Mood } from "@/contexts/PlanContext";

type SavedRow = {
  id: string;
  title: string;
  city: string | null;
  mood: string | null;
  time_budget_hours: number | null;
  plan: GeneratedPlan;
  updated_at: string;
};

const SavedPlans = () => {
  const navigate = useNavigate();
  const { setPlan, setMood, setTimeBudget, setCustomHours, setSavedPlanId } = usePlan();
  const [rows, setRows] = useState<SavedRow[] | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("saved_plans")
      .select("id,title,city,mood,time_budget_hours,plan,updated_at")
      .order("updated_at", { ascending: false });
    if (error) {
      toast("Couldn't load your saved plans", { duration: 3000 });
      setRows([]);
      return;
    }
    setRows((data ?? []) as unknown as SavedRow[]);
  };

  useEffect(() => {
    load();
  }, []);

  const openPlan = (row: SavedRow) => {
    setPlan(row.plan);
    setMood((row.mood as Mood) ?? null);
    if (row.time_budget_hours) {
      setTimeBudget("custom");
      setCustomHours(Number(row.time_budget_hours));
    }
    setSavedPlanId(row.id);
    navigate("/ai/plan/result");
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("saved_plans").delete().eq("id", id);
    setDeletingId(null);
    setConfirmId(null);
    if (error) {
      toast("Couldn't delete plan", { duration: 3000 });
      return;
    }
    toast("Plan deleted", { duration: 2000 });
    setRows((r) => (r ?? []).filter((x) => x.id !== id));
  };

  return (
    <AppLayout title="Saved plans" subtitle="Your itineraries" backTo="/ai/plan">
      <div>
        <h1 className="font-display text-3xl font-light leading-[1.05] tracking-tight text-ink sm:text-4xl">
          Your <span className="italic text-vermilion">itineraries</span>
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Tap any plan to open, edit, or remove it.
        </p>

        {rows === null ? (
          <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-foreground/10 bg-card p-6 text-center shadow-soft">
            <div className="font-display text-2xl font-light leading-tight tracking-tight text-ink">
              No saved plans <span className="italic text-vermilion">yet.</span>
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Build a day and tap the bookmark to save it here.
            </p>
            <button
              onClick={() => navigate("/ai/plan")}
              className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-vermilion px-6 text-sm font-medium text-cream shadow-soft"
            >
              Plan my day
            </button>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => {
              const isConfirming = confirmId === row.id;
              const isDeleting = deletingId === row.id;
              return (
                <li
                  key={row.id}
                  className="relative overflow-hidden rounded-2xl border border-foreground/10 bg-card shadow-soft"
                >
                  <button
                    onClick={() => openPlan(row)}
                    className="block w-full px-4 py-4 text-left"
                  >
                    <div className="font-display text-base text-ink">{row.title}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {row.city && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {row.city}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {row.plan?.stops?.length ?? 0} stops · ~{row.plan?.totalHours ?? 0}h
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center justify-end px-2 pb-2">
                    <button
                      onClick={() => setConfirmId(row.id)}
                      className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/5"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </div>
                  {isConfirming && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/95 px-4 backdrop-blur-sm">
                      <div className="text-center font-serif text-[15px] text-ink">
                        Delete this plan?
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={isDeleting}
                          className="rounded-full bg-primary px-4 py-1.5 text-[13px] font-medium text-primary-foreground shadow-soft"
                        >
                          {isDeleting ? "Removing…" : "Yes, delete"}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="rounded-full bg-transparent px-4 py-1.5 text-[13px] text-muted-foreground"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </AppLayout>
  );
};

export default SavedPlans;