import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  DIETARY_NEEDS,
  DINING_BUDGET_OPTIONS,
  DINING_BUDGET_LABEL,
  INTERESTS,
  SPICE_LEVELS,
  SPICE_LEVEL_LABEL,
  type DiningBudget,
  type InterestSlug,
} from "@/data/profileOptions";

// Number of interests visible before the "+ More" affordance.
const INTERESTS_COLLAPSED = 7;

const TravelPreferences = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();

  const [interests, setInterests] = useState<string[]>([]);
  const [budget, setBudget] = useState<DiningBudget | "">("");
  const [spice, setSpice] = useState<number | null>(null);
  const [needs, setNeeds] = useState<string[]>([]);
  const [showAllInterests, setShowAllInterests] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInterests((profile?.interests ?? []) as string[]);
    setBudget((profile?.dining_budget as DiningBudget | null) ?? "");
    setSpice(profile?.spice_level ?? null);
    setNeeds((profile?.dietary_needs ?? []) as string[]);
  }, [profile]);

  const visibleInterests = useMemo(
    () => (showAllInterests ? INTERESTS : INTERESTS.slice(0, INTERESTS_COLLAPSED)),
    [showAllInterests],
  );

  const toggleInterest = (slug: InterestSlug) =>
    setInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const toggleNeed = (slug: string) =>
    setNeeds((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        interests,
        dining_budget: budget || null,
        spice_level: spice,
        dietary_needs: needs,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Preferences saved");
    navigate("/account");
  };

  return (
    <AppLayout title="Travel preferences" backTo="/account" showLiveActivity={false} hideTabBar>
      <div className="mx-auto max-w-[440px] space-y-6 pb-28">
        {/* Callout */}
        <div className="flex items-start gap-3 rounded-2xl bg-[hsl(var(--tint-warm))] p-4">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]" strokeWidth={2} />
          <p className="text-[14px] leading-snug text-ink">
            These shape what the concierge recommends and books. Update them any time.
          </p>
        </div>

        {/* Interests */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Interests
          </p>
          <div className="flex flex-wrap gap-2">
            {visibleInterests.map(({ slug, label, icon: Icon }) => {
              const selected = interests.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleInterest(slug)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-border bg-white text-ink hover:bg-surface-2"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                  {label}
                </button>
              );
            })}
            {!showAllInterests && INTERESTS.length > INTERESTS_COLLAPSED && (
              <button
                type="button"
                onClick={() => setShowAllInterests(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-2 text-[13px] font-semibold text-ink transition hover:bg-surface-2"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                More
              </button>
            )}
          </div>
        </section>

        {/* Dining */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Dining
          </p>
          <div className="divide-y divide-border rounded-2xl bg-surface-2">
            <RowSelector label="Budget">
              <div className="flex items-center gap-1">
                {DINING_BUDGET_OPTIONS.map((o) => {
                  const active = o.value === budget;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setBudget(o.value)}
                      className={`min-w-[44px] rounded-full px-3 py-1 text-[14px] font-bold transition ${
                        active ? "bg-ink text-white" : "text-ink-tertiary hover:text-ink"
                      }`}
                      aria-pressed={active}
                    >
                      {o.label}
                    </button>
                  );
                })}
                {budget === "luxury" && (
                  <span className="ml-1 text-[13px] font-semibold text-ink">
                    {DINING_BUDGET_LABEL.luxury}
                  </span>
                )}
              </div>
            </RowSelector>
            <RowSelector label="Spice level">
              <select
                value={spice ?? ""}
                onChange={(e) =>
                  setSpice(e.target.value === "" ? null : Number(e.target.value))
                }
                className="rounded-full bg-transparent py-1 pr-6 text-right text-[14px] font-medium text-ink focus:outline-none"
              >
                <option value="">—</option>
                {SPICE_LEVELS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </RowSelector>
          </div>
          {spice !== null && (
            <p className="mt-1.5 px-1 text-[12px] text-ink-tertiary">
              Currently set to {SPICE_LEVEL_LABEL(spice)}.
            </p>
          )}
        </section>

        {/* Dietary needs */}
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
            Dietary needs
          </p>
          <div className="flex flex-wrap gap-2">
            {DIETARY_NEEDS.map(({ slug, label }) => {
              const selected = needs.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  onClick={() => toggleNeed(slug)}
                  className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                    selected
                      ? "border-ink bg-ink text-white"
                      : "border-border bg-white text-ink hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Sticky CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-[440px]">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save preferences
          </button>
        </div>
      </div>
    </AppLayout>
  );
};

const RowSelector = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex items-center justify-between gap-3 px-4 py-3.5">
    <p className="text-[15px] font-semibold text-ink">{label}</p>
    {children}
  </div>
);

export default TravelPreferences;
