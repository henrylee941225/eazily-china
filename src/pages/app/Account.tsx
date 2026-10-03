import { useMemo } from "react";
import { useBookingAllowance } from "@/hooks/useBookingAllowance";
import { TripDatesNudge } from "@/components/trip/TripDatesNudge";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  Settings, Calendar, Ticket, ClipboardCheck, CalendarCheck, Languages,
  KeyRound, Bell, ChevronRight, Sparkles, Zap, Coins, FileText, Shield, Cookie, Trash2,
  type LucideIcon,
} from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCurrency, SUPPORTED_CURRENCIES } from "@/contexts/CurrencyContext";
import {
  INTEREST_LABELS,
} from "@/data/profileOptions";
import {
  PRETRIP_TOTAL,
  pretripDoneCount,
  isPretripComplete,
} from "@/data/pretripTasks";

// ---- Trip range formatting ------------------------------------------------
// "20-27 May" when both dates fall in the same month/year,
// "28 May - 3 Jun" otherwise. Returns "" if either side is missing.
const formatTripRange = (arrival?: string | null, departure?: string | null): string => {
  if (!arrival || !departure) return arrival || departure ? "Set dates" : "";
  const a = new Date(arrival);
  const d = new Date(departure);
  if (Number.isNaN(a.getTime()) || Number.isNaN(d.getTime())) return "";
  const sameMonth = a.getMonth() === d.getMonth() && a.getFullYear() === d.getFullYear();
  if (sameMonth) return `${format(a, "d")}–${format(d, "d MMM")}`;
  return `${format(a, "d MMM")} – ${format(d, "d MMM")}`;
};

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const { currency: prefCurrency } = useCurrency();
  const currencyMeta = SUPPORTED_CURRENCIES.find((c) => c.code === prefCurrency);
  const currencyLabel = currencyMeta
    ? `${currencyMeta.label} · ${currencyMeta.code} ${currencyMeta.symbol}`
    : prefCurrency;
  const displayName = profile?.display_name || profile?.full_name || "Traveller";
  const email = user?.email ?? "";
  const initial = (displayName || email || "?").trim().charAt(0).toUpperCase();
  const interestSlugs = (profile?.interests ?? []).filter(Boolean);
  const tripRange = formatTripRange(profile?.arrival_date, profile?.departure_date);
  const pretripDone = pretripDoneCount(profile?.pretrip_tasks_done);
  const pretripPct = Math.round((pretripDone / PRETRIP_TOTAL) * 100);
  const pretripComplete = isPretripComplete(profile?.pretrip_tasks_done);

  // Show first 3 chips + "+N" overflow, exactly like the mockup.
  const chipsShown = useMemo(() => interestSlugs.slice(0, 3), [interestSlugs]);
  const overflowCount = Math.max(0, interestSlugs.length - chipsShown.length);

  const { allowance } = useBookingAllowance();

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <AppLayout
      title="Account"
      backTo="/"
      showLiveActivity={false}
      headerRight={
        <a
          href="#settings-support"
          aria-label="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-2 text-ink transition hover:bg-surface-3"
        >
          <Settings className="h-5 w-5" strokeWidth={1.8} />
        </a>
      }
    >
      <div className="mx-auto max-w-[440px] space-y-6 pb-8">
        {/* Identity card */}
        <section className="rounded-2xl border border-border bg-white p-4">
          <div className="flex items-center gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-[22px] font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(135deg, hsl(var(--brand-orange)) 0%, #EA470A 100%)",
              }}
              aria-hidden
            >
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[17px] font-bold leading-tight text-ink">{displayName}</p>
              <p className="mt-0.5 truncate text-[13px] text-ink-secondary">{email || "—"}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/account/edit")}
              className="shrink-0 rounded-full border border-[hsl(var(--brand-red))] px-4 py-1.5 text-[13px] font-semibold text-[hsl(var(--brand-red))] transition hover:bg-[hsl(var(--brand-red))]/5"
            >
              Edit
            </button>
          </div>
        </section>

        {/* Travel preferences (dark card) */}
        <button
          type="button"
          onClick={() => navigate("/account/preferences")}
          className="block w-full rounded-2xl bg-ink p-4 text-left transition active:opacity-95"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[hsl(var(--brand-orange))]" strokeWidth={2} />
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-[hsl(var(--brand-orange))]">
              Tunes your concierge
            </span>
          </div>
          <p className="mt-2 text-[20px] font-bold leading-tight text-white">Travel preferences</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {chipsShown.length === 0 ? (
              <span className="rounded-full border border-white/25 px-3 py-1 text-[13px] font-medium text-white/80">
                Pick your interests
              </span>
            ) : (
              chipsShown.map((slug) => (
                <span
                  key={slug}
                  className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold text-white"
                >
                  {INTEREST_LABELS[slug] ?? slug}
                </span>
              ))
            )}
            {overflowCount > 0 && (
              <span className="rounded-full border border-white/25 px-3 py-1 text-[13px] font-semibold text-white">
                +{overflowCount}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-center justify-between text-white/80">
            <span className="text-[13px]">Manage what shapes your picks</span>
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </div>
        </button>

        {/* TRIP */}
        <TripDatesNudge />
        <SectionGroup label="Trip">
          <Row
            icon={Calendar}
            title="Trip dates & details"
            trailing={tripRange ? <MetaText>{tripRange}</MetaText> : undefined}
            onClick={() => navigate("/account/trip")}
          />
          <Row
            icon={ClipboardCheck}
            title="Pre-trip checklist"
            trailing={
              pretripComplete ? (
                <MetaText>Done</MetaText>
              ) : pretripDone > 0 ? (
                <span className="rounded-full bg-[hsl(var(--tint-warm))] px-2 py-0.5 text-[12px] font-bold text-[hsl(var(--pending-text,#C15E01))]">
                  {pretripPct}%
                </span>
              ) : undefined
            }
            onClick={() => navigate("/pretrip")}
          />
          <Row
            icon={Ticket}
            title="Trip Pass"
            trailing={<MetaText>{allowance ? `${allowance.remaining} bookings left` : "Not active"}</MetaText>}
            onClick={() => navigate("/trip-pass")}
          />
          <Row
            icon={Zap}
            title="What things cost"
            trailing={<MetaText>Bookings and transfers</MetaText>}
            onClick={() => navigate("/pricing")}
          />
          <Row
            icon={Coins}
            title="Currency"
            trailing={<MetaText>{currencyLabel}</MetaText>}
            onClick={() => navigate("/account/currency")}
          />
        </SectionGroup>

        {/* ACTIVITY */}
        <SectionGroup label="Activity">
          <Row
            icon={CalendarCheck}
            title="My bookings"
            onClick={() => navigate("/bookings")}
          />
        </SectionGroup>

        {/* SETTINGS & SUPPORT */}
        <SectionGroup label="Settings & support" id="settings-support">
          <Row
            icon={Languages}
            title="Language"
            trailing={<MetaText>English</MetaText>}
            disabled
          />
          <Row
            icon={Bell}
            title="Notifications"
            onClick={() => navigate("/account/notifications")}
          />
          <Row
            icon={KeyRound}
            title="Change password"
            onClick={() => navigate("/account/edit#security")}
          />
        </SectionGroup>

        {/* Log out */}
        <SectionGroup label="Legal">
          <Row icon={Shield} title="Privacy Policy" onClick={() => navigate("/legal/privacy")} />
          <Row icon={FileText} title="Terms & Conditions" onClick={() => navigate("/legal/terms")} />
          <Row icon={Cookie} title="Cookie Policy" onClick={() => navigate("/legal/cookies")} />
        </SectionGroup>

        <SectionGroup label="Your account">
          <Row
            icon={Trash2}
            title="Delete my account"
            onClick={() => navigate("/account/delete")}
          />
        </SectionGroup>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full py-3 text-center text-[15px] font-semibold text-[hsl(var(--brand-red))] transition hover:opacity-80"
        >
          Log out
        </button>

        <p className="pb-4 text-center text-[12px] text-ink-tertiary">eazilyChina · v1.0.0</p>
      </div>
    </AppLayout>
  );
};

// ---- Row + group helpers -------------------------------------------------

const SectionGroup = ({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: React.ReactNode;
}) => (
  <section id={id} className="space-y-2">
    <p className="px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
      {label}
    </p>
    <div className="divide-y divide-border rounded-2xl border border-border bg-white">
      {children}
    </div>
  </section>
);

const MetaText = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[13px] font-medium text-ink-secondary">{children}</span>
);

const Row = ({
  icon: Icon,
  title,
  trailing,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) => {
  const inner = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center text-ink">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </span>
      <span className="flex-1 text-[15px] font-semibold text-ink">{title}</span>
      {trailing}
      {!disabled && (
        <ChevronRight className="h-4 w-4 text-ink-tertiary" strokeWidth={2} />
      )}
    </>
  );
  if (disabled || !onClick) {
    return (
      <div className="flex items-center gap-3 px-4 py-4">
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-surface-2/60 active:bg-surface-2"
    >
      {inner}
    </button>
  );
};

export default Account;
