import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/contexts/CurrencyContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import NationalitySelect from "@/components/NationalitySelect";
import { resolveNationalityCode } from "@/data/nationalities";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LucideIcon } from "lucide-react";
import {
  Palette,
  Utensils,
  Sandwich,
  Landmark,
  Mountain,
  Wine,
  ShoppingBag,
  Camera,
  Store,
  Coffee,
  Building2,
  Sparkles,
  Plane,
  MapPin,
  Calendar,
  Info,
  Check,
  Loader2,
  ChevronLeft,
} from "lucide-react";

// ---------- Interest slugs (persisted in profiles.interests) ----------
const INTERESTS: { slug: string; label: string; icon: LucideIcon }[] = [
  { slug: "art_museums", label: "Art & museums", icon: Palette },
  { slug: "fine_dining", label: "Fine dining", icon: Utensils },
  { slug: "street_food", label: "Street food", icon: Sandwich },
  { slug: "history", label: "History", icon: Landmark },
  { slug: "nature", label: "Nature", icon: Mountain },
  { slug: "nightlife", label: "Nightlife", icon: Wine },
  { slug: "shopping", label: "Shopping", icon: ShoppingBag },
  { slug: "photography", label: "Photography", icon: Camera },
  { slug: "markets", label: "Markets", icon: Store },
  { slug: "tea_coffee", label: "Tea & coffee", icon: Coffee },
  { slug: "architecture", label: "Architecture", icon: Building2 },
];

// ---------- Currency guess ----------
const REGION_CURRENCY: Record<string, CurrencyCode> = {
  GB: "GBP", US: "USD", CA: "CAD", AU: "AUD", NZ: "NZD", JP: "JPY", CH: "CHF",
  HK: "HKD", SG: "SGD", KR: "KRW", IN: "INR", TH: "THB", MY: "MYR", ID: "IDR",
  PH: "PHP", MX: "MXN", BR: "BRL", ZA: "ZAR", SE: "SEK", NO: "NOK",
  IE: "EUR", FR: "EUR", DE: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", FI: "EUR",
  AT: "EUR", BE: "EUR", PT: "EUR", DK: "EUR", AE: "USD",
};

const regionFromLocale = (): string | null => {
  try {
    const locale = navigator.languages?.[0] ?? navigator.language;
    if (!locale) return null;
    const parts = locale.split("-");
    const region = parts[parts.length - 1];
    return region.length === 2 ? region.toUpperCase() : null;
  } catch {
    return null;
  }
};

/** Device locale first, step-1 nationality as fallback, GBP final fallback. */
const guessCurrency = (nationality: string): CurrencyCode => {
  const localeRegion = regionFromLocale();
  if (localeRegion && REGION_CURRENCY[localeRegion]) return REGION_CURRENCY[localeRegion];
  if (nationality && REGION_CURRENCY[nationality]) return REGION_CURRENCY[nationality];
  return "GBP";
};

// ---------- Validation ----------
const personalSchema = z.object({
  full_name: z.string().trim().max(120).optional().or(z.literal("")),
  nationality: z.string().length(2).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
});

const tripSchema = z
  .object({
    arrival_date: z.string().optional().or(z.literal("")),
    departure_date: z.string().optional().or(z.literal("")),
    already_in_china: z.enum(["yes", "no"]).nullable().optional(),
  })
  .refine(
    (v) =>
      !v.arrival_date ||
      !v.departure_date ||
      new Date(v.arrival_date) <= new Date(v.departure_date),
    { message: "Departure must be after arrival", path: ["departure_date"] },
  );

// ---------- Shared chrome ----------
const StepChrome = ({
  step,
  total,
  onSkip,
  onBack,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled,
  primaryBusy,
}: {
  step: number;
  total: number;
  onSkip: () => void;
  onBack?: () => void;
  children: React.ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryBusy?: boolean;
}) => (
  <div className="flex min-h-[100dvh] flex-col bg-surface">
    <div
      className="px-5 pt-3 pb-2"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}
    >
      <div className="flex items-center justify-between">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="flex h-11 w-11 -ml-2 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSkip}
          className="text-[13px] font-medium text-[hsl(var(--text-secondary))] hover:text-ink transition"
        >
          Skip
        </button>
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-300"
            style={{ width: `${(step / total) * 100}%` }}
          />
        </div>
        <span className="text-[13px] font-medium text-[hsl(var(--text-secondary))]">
          {step} / {total}
        </span>
      </div>
    </div>

    <div className="flex-1 overflow-y-auto px-5 pt-4 pb-32">{children}</div>

    <div
      className="fixed inset-x-0 bottom-0 z-30 bg-gradient-to-t from-surface via-surface to-transparent px-5 pt-4"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 16px)" }}
    >
      <button
        type="button"
        onClick={onPrimary}
        disabled={primaryDisabled || primaryBusy}
        className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition hover:bg-ink/90 disabled:opacity-40"
      >
        {primaryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryLabel}
      </button>
    </div>
  </div>
);

// ---------- Page ----------
type StepId = 1 | 2 | 3;

const ProfileSetup = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nextParam = searchParams.get("next");
  const safeNext = nextParam && nextParam.startsWith("/") ? nextParam : null;
  // Ops fulfillers don't need the traveller wizard — just a name for the
  // dispatch header, then straight to /ops (where the access wall handles
  // the pre-role-grant case).
  const isOpsFlow = safeNext?.startsWith("/ops") ?? false;
  // Default landing after setup is Home. A deep-linked ?next= wins, except
  // for /account — that target is only ever auto-captured by RequireAuth and
  // is the wrong place to drop a brand-new user.
  const finalRedirect = !safeNext || safeNext === "/account" ? "/" : safeNext;
  const { user, profile, loading, refreshProfile } = useAuth();
  const { currency, setCurrency } = useCurrency();

  useEffect(() => {
    if (!isOpsFlow) return;
    console.info("[ops signup trace] profile setup mounted", {
      url: window.location.href,
      next: safeNext,
      branch: "ops-name-only",
    });
  }, [isOpsFlow, safeNext]);

  const [step, setStep] = useState<StepId>(1);
  const [saving, setSaving] = useState(false);

  // Personal
  const [fullName, setFullName] = useState("");
  const [nationality, setNationality] = useState<string>("");
  const [phone, setPhone] = useState("");

  // Interests
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);

  // Trip
  const [arrivalDate, setArrivalDate] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [alreadyInChina, setAlreadyInChina] = useState<"yes" | "no" | null>(null);
  const [preferredCurrency, setPreferredCurrency] = useState<CurrencyCode | null>(null);

  // Pre-select the currency: device locale → step-1 nationality → GBP.
  useEffect(() => {
    if (preferredCurrency) return;
    setPreferredCurrency(guessCurrency(nationality));
  }, [nationality, preferredCurrency]);

  // Hydrate from existing profile (best-effort)
  useEffect(() => {
    if (!profile) return;
    setFullName((profile as any).full_name ?? profile.display_name ?? "");
    setNationality(resolveNationalityCode((profile as any).nationality));
    setPhone((profile as any).phone ?? "");
    setSelectedInterests(profile.interests ?? []);
    setArrivalDate(profile.arrival_date ?? "");
    setDepartureDate(profile.departure_date ?? "");
    const air = (profile as any).already_in_china;
    setAlreadyInChina(air === true ? "yes" : air === false ? "no" : null);
  }, [profile]);

  // If already completed, jump home immediately.
  useEffect(() => {
    if (!loading && profile && (profile as any).profile_setup_completed) {
      navigate(finalRedirect, { replace: true });
    }
  }, [loading, profile, navigate, finalRedirect]);

  const totalSteps = 3;

  const persist = async (patch: TablesUpdate<"profiles">) => {
    if (!user) return true; // no session yet — silently skip write, still advance
    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
      return false;
    }
    await refreshProfile();
    return true;
  };

  const finish = async (extra: TablesUpdate<"profiles"> = {}) => {
    setSaving(true);
    // profile_setup_completed is the single post-signup gate.
    // onboarding_completed is kept in lockstep for any legacy code that still reads it.
    const ok = await persist({
      profile_setup_completed: true,
      onboarding_completed: true,
      ...extra,
    });
    setSaving(false);
    if (ok) {
      if (isOpsFlow) {
        console.info("[ops signup trace] profile setup finished", {
          url: window.location.href,
          to: finalRedirect,
        });
      }
      navigate(finalRedirect, { replace: true });
    }
  };

  // ---- Step 1: About you ----
  const submitStep1 = async () => {
    const parsed = personalSchema.safeParse({
      full_name: fullName,
      nationality,
      phone,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSaving(true);
    const patch: TablesUpdate<"profiles"> = {};
    if (fullName.trim()) {
      patch.full_name = fullName.trim();
      // keep display_name aligned when the user hasn't set one distinct
      if (!profile?.display_name) patch.display_name = fullName.trim();
    }
    if (nationality) patch.nationality = nationality;
    if (phone.trim()) patch.phone = phone.trim();
    const ok = await persist(patch);
    setSaving(false);
    if (ok) setStep(2);
  };

  const skipStep1 = () => setStep(2);

  // ---- Step 2: Interests ----
  const toggleInterest = (slug: string) => {
    setSelectedInterests((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const submitStep2 = async () => {
    setSaving(true);
    const ok = await persist({ interests: selectedInterests });
    setSaving(false);
    if (ok) setStep(3);
  };

  const skipStep2 = () => setStep(3);

  // ---- Step 3: Trip ----
  const submitStep3 = async () => {
    const parsed = tripSchema.safeParse({
      arrival_date: arrivalDate,
      departure_date: departureDate,
      already_in_china: alreadyInChina,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your dates");
      return;
    }
    const patch: TablesUpdate<"profiles"> = {};
    if (arrivalDate) patch.arrival_date = arrivalDate;
    if (departureDate) patch.departure_date = departureDate;
    if (alreadyInChina !== null) patch.already_in_china = alreadyInChina === "yes";
    if (preferredCurrency && preferredCurrency !== currency) {
      await setCurrency(preferredCurrency);
    }
    await finish(patch);
  };

  const skipStep3 = () => finish();

  const interestCount = selectedInterests.length;

  const step2Primary = useMemo(
    () => (interestCount > 0 ? `Continue · ${interestCount} picked` : "Continue"),
    [interestCount],
  );

  // ---------- Renders ----------
  // Ops fulfiller signup: just capture a name for the dispatch header, then
  // hand off to /ops (which shows the access wall until a role is granted).
  if (isOpsFlow) {
    const submitOps = async () => {
      if (!fullName.trim()) {
        toast.error("Please enter your full name");
        return;
      }
      await finish({
        full_name: fullName.trim(),
        ...(profile?.display_name ? {} : { display_name: fullName.trim() }),
      });
    };
    return (
      <StepChrome
        step={1}
        total={1}
        onSkip={() => finish()}
        onPrimary={submitOps}
        primaryBusy={saving}
        primaryDisabled={!fullName.trim()}
        primaryLabel="Continue"
      >
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          Your name
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[hsl(var(--text-secondary))]">
          Shown on the dispatch header so the team knows who's on shift.
        </p>
        <div className="mt-6">
          <Label
            htmlFor="ops_full_name"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]"
          >
            Full name
          </Label>
          <Input
            id="ops_full_name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Alex Chen"
            maxLength={120}
            className="mt-2 h-[52px] rounded-2xl border-transparent bg-surface-2 px-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
          />
        </div>
      </StepChrome>
    );
  }

  if (step === 1) {
    return (
      <StepChrome
        step={1}
        total={totalSteps}
        onSkip={skipStep1}
        onPrimary={submitStep1}
        primaryBusy={saving}
        primaryLabel="Continue"
      >
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          About you
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[hsl(var(--text-secondary))]">
          So bookings and the concierge know who to ask for.
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label
              htmlFor="full_name"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]"
            >
              Full name
            </Label>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Chen"
              maxLength={120}
              className="mt-2 h-[52px] rounded-2xl border-transparent bg-surface-2 px-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
            />
          </div>

          <div>
            <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]">
              Nationality
            </Label>
            <NationalitySelect
              value={nationality}
              onChange={setNationality}
              className="mt-2"
            />
          </div>

          <div>
            <Label
              htmlFor="phone"
              className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]"
            >
              Phone <span className="text-[hsl(var(--text-tertiary))]">· Optional</span>
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="+44 7700 900000"
              maxLength={32}
              className="mt-2 h-[52px] rounded-2xl border-transparent bg-surface-2 px-4 text-[15px] focus-visible:ring-0 focus-visible:border-ink/20"
            />
          </div>
        </div>
      </StepChrome>
    );
  }

  if (step === 2) {
    return (
      <StepChrome
        step={2}
        total={totalSteps}
        onSkip={skipStep2}
        onBack={() => setStep(1)}
        onPrimary={submitStep2}
        primaryBusy={saving}
        primaryLabel={step2Primary}
      >
        <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
          What are you into?
        </h1>
        <p className="mt-2 text-[15px] leading-snug text-[hsl(var(--text-secondary))]">
          Pick a few — the concierge tailors recommendations to your taste.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          {INTERESTS.map(({ slug, label, icon: Icon }) => {
            const active = selectedInterests.includes(slug);
            return (
              <button
                key={slug}
                type="button"
                onClick={() => toggleInterest(slug)}
                aria-pressed={active}
                className={`inline-flex h-11 items-center gap-2 rounded-full px-4 text-[14px] font-semibold transition ${
                  active
                    ? "bg-ink text-white"
                    : "bg-surface text-ink border border-[hsl(var(--hairline))]"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[hsl(var(--tint-warm))] px-4 py-3">
          <Sparkles
            className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--brand-orange))]"
            strokeWidth={2}
          />
          <p className="text-[13px] leading-snug text-ink">
            These shape what the concierge recommends. You can refine them any time in your profile.
          </p>
        </div>
      </StepChrome>
    );
  }

  // Step 3
  return (
    <StepChrome
      step={3}
      total={totalSteps}
      onSkip={skipStep3}
      onBack={() => setStep(2)}
      onPrimary={submitStep3}
      primaryBusy={saving}
      primaryLabel="Continue"
    >
      <h1 className="font-display text-[28px] font-extrabold leading-[1.15] tracking-tight text-ink">
        Your trip
      </h1>
      <p className="mt-2 text-[15px] leading-snug text-[hsl(var(--text-secondary))]">
        Dates help us time recommendations and bookings.
      </p>

      <div className="mt-6">
        <Label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]">
          Prices in
        </Label>
        <Select
          value={preferredCurrency ?? undefined}
          onValueChange={(v) => setPreferredCurrency(v as CurrencyCode)}
        >
          <SelectTrigger className="mt-2 h-[52px] rounded-2xl border-transparent bg-surface-2 px-4 text-[15px] focus:ring-0 focus:ring-offset-0">
            <SelectValue placeholder="Select your currency" />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((c) => (
              <SelectItem key={c.code} value={c.code}>
                {c.code} · {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[13px] leading-snug text-[hsl(var(--text-secondary))]">
          You can change this any time in Account.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3">
        <div>
          <Label
            htmlFor="arrival"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]"
          >
            Arrive
          </Label>
          <div className="relative mt-2">
            <Calendar
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-secondary))]"
              strokeWidth={1.75}
            />
            <Input
              id="arrival"
              type="date"
              value={arrivalDate}
              onChange={(e) => setArrivalDate(e.target.value)}
              className="h-[52px] w-full min-w-0 rounded-2xl border-transparent bg-surface-2 pl-10 pr-2 text-[14px] focus-visible:ring-0 focus-visible:border-ink/20"
            />
          </div>
        </div>
        <div>
          <Label
            htmlFor="departure"
            className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]"
          >
            Leave
          </Label>
          <div className="relative mt-2">
            <Calendar
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[hsl(var(--text-secondary))]"
              strokeWidth={1.75}
            />
            <Input
              id="departure"
              type="date"
              value={departureDate}
              onChange={(e) => setDepartureDate(e.target.value)}
              className="h-[52px] w-full min-w-0 rounded-2xl border-transparent bg-surface-2 pl-10 pr-2 text-[14px] focus-visible:ring-0 focus-visible:border-ink/20"
            />
          </div>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[hsl(var(--text-secondary))]">
          Are you already in China?
        </p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(
            [
              { id: "no" as const, title: "Not yet", meta: "Still planning", icon: Plane, color: "text-ink" },
              { id: "yes" as const, title: "I'm here", meta: "On the ground", icon: MapPin, color: "text-[hsl(var(--brand-red))]" },
            ]
          ).map(({ id, title, meta, icon: Icon, color }) => {
            const active = alreadyInChina === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setAlreadyInChina(id)}
                aria-pressed={active}
                className={`relative flex flex-col items-center justify-center gap-1 rounded-2xl px-3 py-5 text-center transition ${
                  active
                    ? "border-2 border-ink bg-surface"
                    : "border border-[hsl(var(--hairline))] bg-surface"
                }`}
              >
                {active && (
                  <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <Icon className={`h-6 w-6 ${color}`} strokeWidth={1.75} />
                <span className="mt-1 text-[15px] font-semibold text-ink">{title}</span>
                <span className="text-[13px] text-[hsl(var(--text-secondary))]">{meta}</span>
              </button>
            );
          })}
        </div>

        {alreadyInChina === "no" && (
          <div className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-2 px-4 py-3">
            <Info
              className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--text-secondary))]"
              strokeWidth={1.75}
            />
            <p className="text-[13px] leading-snug text-[hsl(var(--text-secondary))]">
              Not yet in China? Your pre-trip checklist is waiting on Home.
            </p>
          </div>
        )}
      </div>
    </StepChrome>
  );
};

export default ProfileSetup;