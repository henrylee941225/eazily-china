import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, ChevronDown, KeyRound, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES, type CurrencyCode } from "@/contexts/CurrencyContext";
import { NATIONALITIES, dialForNationality } from "@/data/profileOptions";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Please enter your name").max(120, "Name is too long"),
  nationality: z.string().length(2).optional().or(z.literal("")),
  phone: z.string().trim().max(32).optional().or(z.literal("")),
  preferred_currency: z.string().min(3).max(3),
});

// The profile editor: identity fields the user needs to keep current for
// bookings + concierge. Trip dates live on a separate `/account/trip`
// screen so this form stays focused.
const EditProfile = () => {
  const navigate = useNavigate();
  const { user, profile, refreshProfile } = useAuth();
  const { currency, setCurrency } = useCurrency();

  // Snapshot the profile at mount so "Save" only activates when something
  // actually changes.
  const initial = useMemo(
    () => ({
      full_name: profile?.full_name ?? profile?.display_name ?? "",
      nationality: profile?.nationality ?? "",
      phone: profile?.phone ?? "",
      preferred_currency: (profile?.preferred_currency as CurrencyCode) ?? currency,
    }),
    // Only recompute when the profile row changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile?.user_id, profile?.full_name, profile?.display_name, profile?.nationality, profile?.phone, profile?.preferred_currency],
  );

  const [fullName, setFullName] = useState(initial.full_name);
  const [nationality, setNationality] = useState(initial.nationality);
  // Phone is stored on the profile as a single string ("+44 7700 900000").
  // We split it back into dial code + national number for editing.
  const initialDial = useMemo(() => {
    const p = initial.phone.trim();
    const match = NATIONALITIES.find((n) => p.startsWith(n.dial));
    return match?.dial ?? dialForNationality(initial.nationality);
  }, [initial.phone, initial.nationality]);
  const initialLocal = useMemo(() => {
    const p = initial.phone.trim();
    if (!p) return "";
    return p.startsWith(initialDial) ? p.slice(initialDial.length).trim() : p;
  }, [initial.phone, initialDial]);
  const [dial, setDial] = useState(initialDial);
  const [phoneLocal, setPhoneLocal] = useState(initialLocal);
  const [homeCurrency, setHomeCurrency] = useState<CurrencyCode>(initial.preferred_currency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFullName(initial.full_name);
    setNationality(initial.nationality);
    setDial(initialDial);
    setPhoneLocal(initialLocal);
    setHomeCurrency(initial.preferred_currency);
  }, [initial, initialDial, initialLocal]);

  // When the user picks a nationality manually, snap the dial code to it —
  // unless they've already typed a national number, in which case we don't
  // want to yank the prefix out from under them.
  const changeNationality = (v: string) => {
    setNationality(v);
    if (!phoneLocal.trim()) setDial(dialForNationality(v));
  };

  const composedPhone = phoneLocal.trim() ? `${dial} ${phoneLocal.trim()}` : "";
  const dirty =
    fullName.trim() !== (initial.full_name ?? "").trim() ||
    (nationality || "") !== (initial.nationality || "") ||
    composedPhone !== (initial.phone ?? "").trim() ||
    homeCurrency !== initial.preferred_currency;

  const email = user?.email ?? "";
  const initialLetter = (fullName || email || "?").trim().charAt(0).toUpperCase();

  const save = async () => {
    if (!user) return;
    const parsed = profileSchema.safeParse({
      full_name: fullName,
      nationality,
      phone: composedPhone,
      preferred_currency: homeCurrency,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        display_name: profile?.display_name ?? fullName.trim(),
        nationality: nationality || null,
        phone: composedPhone || null,
        preferred_currency: homeCurrency,
      })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Keep the currency context in sync so the FX widget picks it up.
    if (homeCurrency !== currency) setCurrency(homeCurrency);
    await refreshProfile();
    toast.success("Profile updated");
    navigate("/account");
  };

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b border-border bg-white"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto flex max-w-[440px] items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={() => navigate("/account")}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
          >
            <X className="h-5 w-5" strokeWidth={2} />
          </button>
          <h1 className="flex-1 text-[20px] font-bold text-ink">Edit profile</h1>
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className={`text-[15px] font-semibold transition ${
              !dirty || saving
                ? "text-ink-tertiary"
                : "text-[hsl(var(--brand-red))] hover:opacity-80"
            }`}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[440px] px-5 pt-6">
        {/* Avatar (display only — no upload) */}
        <div className="flex flex-col items-center">
          <div
            className="flex h-24 w-24 items-center justify-center rounded-full text-[36px] font-extrabold text-white"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--brand-orange)) 0%, #EA470A 100%)",
            }}
            aria-hidden
          >
            {initialLetter}
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <Field label="Full name">
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              maxLength={120}
              placeholder="Your name"
              className="w-full rounded-2xl bg-surface-2 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
            />
          </Field>

          <Field label="Email">
            <div className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3.5">
              <span className="flex-1 truncate text-[15px] text-ink">{email || "—"}</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-[hsl(var(--success))]">
                <CheckCircle2 className="h-3 w-3" strokeWidth={2.5} />
                Verified
              </span>
            </div>
            {/* Email change flow not wired in this app — link intentionally omitted. */}
          </Field>

          <Field label="Nationality">
            <div className="relative">
              <select
                value={nationality}
                onChange={(e) => changeNationality(e.target.value)}
                className="w-full appearance-none rounded-2xl bg-surface-2 px-4 py-3.5 pr-10 text-[15px] text-ink focus:outline-none"
              >
                <option value="">Select…</option>
                {NATIONALITIES.map((n) => (
                  <option key={n.code} value={n.code}>{n.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" strokeWidth={2} />
            </div>
          </Field>

          <Field label="Phone" hint="Optional">
            <div className="flex items-stretch gap-2">
              <div className="relative shrink-0">
                <select
                  value={dial}
                  onChange={(e) => setDial(e.target.value)}
                  className="h-full appearance-none rounded-2xl bg-surface-2 px-4 py-3.5 pr-8 text-[15px] font-semibold text-ink focus:outline-none"
                >
                  {NATIONALITIES.map((n) => (
                    <option key={n.code} value={n.dial}>{n.dial}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-secondary" strokeWidth={2} />
              </div>
              <input
                value={phoneLocal}
                onChange={(e) => setPhoneLocal(e.target.value.replace(/[^\d\s-]/g, ""))}
                inputMode="tel"
                maxLength={20}
                placeholder="7700 900000"
                className="flex-1 rounded-2xl bg-surface-2 px-4 py-3.5 text-[15px] text-ink placeholder:text-ink-tertiary focus:outline-none"
              />
            </div>
          </Field>

          <Field label="Home currency">
            <div className="relative">
              <select
                value={homeCurrency}
                onChange={(e) => setHomeCurrency(e.target.value as CurrencyCode)}
                className="w-full appearance-none rounded-2xl bg-surface-2 px-4 py-3.5 pr-10 text-[15px] text-ink focus:outline-none"
              >
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} {c.flag ? `· ${c.flag}` : ""} {c.label ? `· ${c.label}` : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-secondary" strokeWidth={2} />
            </div>
          </Field>

          <div id="security" className="pt-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
              Security
            </p>
            <button
              type="button"
              onClick={async () => {
                if (!email) {
                  toast.error("No email on file for this account");
                  return;
                }
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) toast.error(error.message);
                else toast.success("Check your inbox to set a new password");
              }}
              className="flex w-full items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3.5 text-left transition hover:bg-surface-3"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-ink">
                <KeyRound className="h-4 w-4" strokeWidth={2} />
              </span>
              <span className="flex-1 text-[15px] font-semibold text-ink">Change password</span>
            </button>
          </div>
        </div>
      </main>

      {/* Sticky CTA */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
      >
        <div className="mx-auto max-w-[440px]">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3.5 text-[15px] font-semibold text-white transition disabled:opacity-40"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
};

const Field = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div>
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
      {label}{hint ? <span className="text-ink-tertiary"> · {hint}</span> : null}
    </p>
    {children}
  </div>
);

export default EditProfile;
