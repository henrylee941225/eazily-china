import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  MapPin,
  ChevronRight,
  ChevronLeft,
  UserRound,
  Sparkles,
  ArrowLeftRight,
  Car,
  Languages,
  BookOpen,
  ClipboardList,
  Compass,
  Utensils,
  Sunrise,
  Plane,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  CreditCard,
  MoreHorizontal,
  EyeOff,
  X,
} from "lucide-react";
import { BottomTabBar } from "@/components/BottomTabBar";
import { PreTripCard } from "@/components/pretrip/PreTripCard";
import { PassExtendedNotice } from "@/components/trip/PassExtendedNotice";
import { HomeRecommendations } from "@/components/HomeRecommendations";
import { TodaysPlanCard } from "@/components/home/TodaysPlanCard";
import { useCity } from "@/contexts/CityContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { triggerHaptic } from "@/integrations/median";
import {
  STATUS_LABEL,
  TONE_CLASSES,
  isTerminal,
  statusTone,
  type ConciergeStatus,
} from "@/lib/conciergeStatus";
import { resolvePaymentPresentation } from "@/lib/paymentPhase";
import { categoryIcon } from "@/lib/conciergeCategory";
import shanghaiHero from "@/assets/shanghai-skyline-hero.jpg";
import { TRANSFERS_ENABLED } from "@/lib/featureFlags";
import { useConciergeLauncher } from "@/components/concierge/ConciergeLauncher";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { toast } from "sonner";
import {
  bookingHideId,
  canHideBooking,
  hideFromHome,
  isBookingSuppressed,
  unhideFromHome,
} from "@/lib/hideFromHome";
import { isTransferPastPickupStale } from "@/lib/bookingExpiry";
import { HOME_CACHE_MAX_AGE_MS, readHomeCache, writeHomeCache } from "@/lib/homeCache";

// Routes that require sign-in. When the visitor is a guest, navigating any of
// these should bounce through /auth?next=<target> so they return here on success.
const AUTH_ROUTES = new Set<string>([
  "/transfers",
  "/book/restaurant",
  "/ai/plan",
  "/concierge/chat",
  "/pretrip",
  "/bookings",
  "/account",
]);

const gatedHref = (to: string, signedIn: boolean) =>
  !signedIn && AUTH_ROUTES.has(to) ? `/auth?next=${encodeURIComponent(to)}` : to;

type BookingRow = {
  id: string;
  summary: string;
  details: string | null;
  status: ConciergeStatus;
  category: string;
  created_at: string;
  updated_at: string;
  booking_reference: string | null;
  paid_at: string | null;
  authorized_at: string | null;
  details_json: unknown;
};

const isBookingRows = (value: unknown): value is BookingRow[] =>
  Array.isArray(value) && value.every((row) =>
    row !== null &&
    typeof row === "object" &&
    typeof row.id === "string" &&
    typeof row.summary === "string" &&
    typeof row.status === "string" &&
    typeof row.created_at === "string" &&
    typeof row.updated_at === "string",
  );

const timeOfDayGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

// Statuses that should surface a notification banner on Home when the user
// hasn't yet acknowledged the change.
const NOTIFY_STATUSES: ConciergeStatus[] = [
  "confirmed",
  "completed", // legacy alias for Confirmed
  "unavailable",
  "change_pending",
];

const bannerCopy = (status: ConciergeStatus, ref: string | null) => {
  switch (status) {
    case "confirmed":
    case "completed":
      return {
        title: "Booking confirmed",
        detail: ref ? `Held under ref ${ref}` : "Tap to see the details",
        icon: CheckCircle2,
        tone: "success" as const,
      };
    case "unavailable":
      return {
        title: "Couldn't book that one",
        detail: "Tap to try another option",
        icon: AlertCircle,
        tone: "error" as const,
      };
    case "change_pending":
      return {
        title: "Change being confirmed",
        detail: "Your original booking is still held",
        icon: RefreshCcw,
        tone: "pending" as const,
      };
    default:
      return null;
  }
};

const SEEN_KEY = "home:booking-seen";
// Only surface banners for status changes that happened recently. Older
// terminal tasks never banner, regardless of dismissal state — this prevents
// historical rows resurfacing when a new one lands.
const BANNER_MAX_AGE_MS = 48 * 60 * 60 * 1000;
// Explicit permanent dismissal set, keyed as `${task_id}:${status}`. Separate
// from SEEN_KEY (kept for backwards compat) so a status transition to a NEW
// state can still surface a fresh banner, but re-entering the same state
// (or a stale realtime replay) never resurrects a dismissed one.
const DISMISSED_KEY = "home:banner-dismissed";

const readSeen = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}");
  } catch {
    return {};
  }
};
const writeSeen = (m: Record<string, string>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(m));
  } catch {
    /* quota */
  }
};
const dismissedKey = (id: string, status: string) => `${id}:${status}`;
const readDismissed = (): Set<string> => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};
const writeDismissed = (s: Set<string>) => {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s]));
  } catch {
    /* quota */
  }
};

const Index = () => {
  const navigate = useNavigate();
  const { city } = useCity();
  const { profile, user, refreshProfile, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const { open: openLauncher } = useConciergeLauncher();
  const signedIn = !!user;

  // First-run: a guest who has never seen the product tour on this device is
  // sent to /welcome. Returning visitors (local flag) and signed-in users stay.
  useEffect(() => {
    if (authLoading || user) return;
    let seen = true;
    try {
      seen = localStorage.getItem("eazilychina:welcomeCompleted") === "true";
    } catch {
      seen = true;
    }
    if (!seen) navigate("/welcome", { replace: true });
  }, [authLoading, user, navigate]);

  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const metadataName = [metadata?.display_name, metadata?.full_name, metadata?.name]
    .find((value): value is string => typeof value === "string" && !!value.trim());
  const rawName = profile?.display_name?.trim() || metadataName?.trim() || "";
  const firstName = signedIn && rawName ? rawName.split(" ")[0] : "";

  // Live bookings — used for the notification banner and "Your bookings".
  const userId = user?.id;
  const { data: bookings } = useQuery<BookingRow[]>({
    queryKey: ["home", "bookings", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("concierge_tasks")
        .select("id,summary,details,status,category,created_at,updated_at,booking_reference,paid_at,authorized_at,hold_released_at,details_json")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as BookingRow[];
      writeHomeCache(userId, "bookings", rows);
      return rows;
    },
    initialData: () => userId ? readHomeCache(userId, "bookings", isBookingRows) : undefined,
    gcTime: HOME_CACHE_MAX_AGE_MS,
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel("home:bookings")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "concierge_tasks", filter: `user_id=eq.${userId}` },
        () => { void queryClient.invalidateQueries({ queryKey: ["home", "bookings", userId] }); },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  // Optimistic hide/undo layer so the card disappears (or returns) instantly,
  // without waiting for the profile refetch.
  const [pendingHidden, setPendingHidden] = useState<string[]>([]);
  const [pendingShown, setPendingShown] = useState<string[]>([]);

  const hiddenKeys = useMemo(() => {
    const base = new Set([...(profile?.hidden_from_home ?? []), ...pendingHidden]);
    pendingShown.forEach((k) => base.delete(k));
    return Array.from(base);
  }, [profile?.hidden_from_home, pendingHidden, pendingShown]);

  const activeBookings = useMemo(
    () => {
      const hidden = hiddenKeys;
      return (bookings ?? []).filter(
        (b) =>
          !isTerminal(b.status) &&
          !isBookingSuppressed(hidden, b.id, b.status) &&
          !isTransferPastPickupStale(b),
      );
    },
    [bookings, hiddenKeys],
  );

  // Per-card overflow menu — one drawer, target set on open.
  const [hideTarget, setHideTarget] = useState<
    { kind: "booking" | "plan"; id: string; label: string } | null
  >(null);

  const confirmHide = async () => {
    if (!user || !hideTarget) return;
    if (hideTarget.kind === "booking") {
      const row = (bookings ?? []).find((b) => b.id === hideTarget.id);
      if (row && !canHideBooking(row.status)) {
        setHideTarget(null);
        return;
      }
    }
    const key = hideTarget.kind === "booking" ? bookingHideId(hideTarget.id) : `plan:${hideTarget.id}`;
    setHideTarget(null);
    setPendingShown((prev) => prev.filter((k) => k !== key));
    setPendingHidden((prev) => (prev.includes(key) ? prev : [...prev, key]));

    const { error } = await hideFromHome(user.id, key, hiddenKeys);
    if (error) {
      setPendingHidden((prev) => prev.filter((k) => k !== key));
      toast.error("Couldn't hide", { description: error.message });
      return;
    }
    await refreshProfile();

    toast("Hidden from Home", {
      description: "It's still in your Bookings.",
      duration: 4000,
      closeButton: true,
      action: {
        label: "Undo",
        onClick: () => {
          void undoHide(key);
        },
      },
    });
  };

  const undoHide = async (key: string) => {
    if (!user) return;
    setPendingHidden((prev) => prev.filter((k) => k !== key));
    setPendingShown((prev) => (prev.includes(key) ? prev : [...prev, key]));
    const { error } = await unhideFromHome(user.id, key, hiddenKeys);
    if (error) {
      setPendingShown((prev) => prev.filter((k) => k !== key));
      toast.error("Couldn't restore", { description: error.message });
      return;
    }
    await refreshProfile();
    setPendingShown((prev) => prev.filter((k) => k !== key));
  };

  // Notification banner: pick the most recently-updated booking whose current
  // status is one we notify on AND that the user hasn't acknowledged yet.
  const [banner, setBanner] = useState<BookingRow | null>(null);
  useEffect(() => {
    if (!bookings || bookings.length === 0) {
      setBanner(null);
      return;
    }
    const seen = readSeen();
    const dismissed = readDismissed();
    const now = Date.now();
    const candidate = [...bookings]
      .filter((b) => NOTIFY_STATUSES.includes(b.status))
      .filter((b) => {
        const ms = Date.parse(b.updated_at);
        return Number.isFinite(ms) && now - ms <= BANNER_MAX_AGE_MS;
      })
      .filter((b) => !dismissed.has(dismissedKey(b.id, b.status)))
      .sort((a, b) => (b.updated_at > a.updated_at ? 1 : -1))
      .find((b) => seen[b.id] !== b.status);
    setBanner(candidate ?? null);
  }, [bookings]);

  const openBannerBooking = () => {
    if (!banner) return;
    const seen = readSeen();
    seen[banner.id] = banner.status;
    writeSeen(seen);
    navigate(`/bookings/${banner.id}`);
  };
  const dismissBanner = () => {
    if (!banner) return;
    const seen = readSeen();
    seen[banner.id] = banner.status;
    writeSeen(seen);
    const dismissed = readDismissed();
    // Dismiss the whole current class of news: any in-window candidate that
    // matches a notify status. Prevents an identical-looking banner from a
    // sibling task surfacing the moment this one is closed.
    const now = Date.now();
    for (const b of bookings ?? []) {
      if (!NOTIFY_STATUSES.includes(b.status)) continue;
      const ms = Date.parse(b.updated_at);
      if (!Number.isFinite(ms) || now - ms > BANNER_MAX_AGE_MS) continue;
      dismissed.add(dismissedKey(b.id, b.status));
    }
    writeDismissed(dismissed);
    setBanner(null);
  };

  const bannerInfo = banner ? bannerCopy(banner.status, banner.booking_reference) : null;

  const handleConcierge = () => {
    triggerHaptic("impactLight");
    if (!signedIn) {
      navigate(`/auth?next=${encodeURIComponent("/concierge/chat")}`);
      return;
    }
    openLauncher();
  };

  return (
    <div className="min-h-screen bg-white pb-[calc(env(safe-area-inset-bottom)+7rem)]">
      {/* 1. Greeting */}
      <header className="mx-auto w-full max-w-[440px] px-5 pt-safe-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[28px] font-extrabold leading-[1.15] text-ink">
              {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ""}
            </h1>
            <div className="mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink">
                <MapPin className="h-3.5 w-3.5 text-[hsl(var(--brand-red))]" strokeWidth={2.2} />
                {city?.name || "Shanghai"}
              </span>
            </div>
          </div>
          {signedIn ? (
            <Link
              to="/account"
              aria-label="Account"
              onClick={() => triggerHaptic("impactLight")}
              className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-secondary transition-colors hover:bg-surface-3"
            >
              <UserRound className="h-5 w-5" strokeWidth={1.8} />
            </Link>
          ) : (
            <Link
              to={`/auth?next=${encodeURIComponent("/")}`}
              onClick={() => triggerHaptic("impactLight")}
              className="mt-1 inline-flex h-11 shrink-0 items-center rounded-full bg-ink px-4 text-[13px] font-semibold text-white transition-colors hover:bg-ink/90"
            >
              Log in
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[440px] space-y-5 px-5 pt-5">
        {/* 2. Notification banner */}
        {banner && bannerInfo && (
          <NotificationBanner
            title={bannerInfo.title}
            detail={bannerInfo.detail}
            icon={bannerInfo.icon}
            tone={bannerInfo.tone}
            onOpen={openBannerBooking}
            onDismiss={dismissBanner}
          />
        )}

        {/* 3. Concierge command bar */}
        <button
          type="button"
          onClick={handleConcierge}
          className="flex w-full items-center gap-3 rounded-full border border-border bg-white px-4 py-2.5 text-left transition-colors hover:bg-surface-2/60"
        >
          <Sparkles
            className="h-4 w-4 shrink-0 text-[hsl(var(--brand-red))]"
            strokeWidth={2}
            fill="currentColor"
          />
          <span className="flex-1 truncate text-[14px] text-ink-secondary">
            Ask or book anything
          </span>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <ChevronRight className="h-4 w-4" strokeWidth={2.2} />
          </span>
        </button>

        {/* 4. Pre-trip checklist — signed-in only */}
        {signedIn && <PassExtendedNotice className="mb-4" />}
        {signedIn && <PreTripCard />}

        {/* 5. Quick access */}
        <section aria-label="Quick access">
          <div className="grid grid-cols-4 gap-2">
            {[
              { to: "/exchange", label: "Exchange", icon: ArrowLeftRight, show: true },
              { to: "/transfers", label: "Ride", icon: Car, show: TRANSFERS_ENABLED },
              { to: "/translate", label: "Translate", icon: Languages, show: true },
              { to: "/guides", label: "Guides", icon: BookOpen, show: true },
            ].filter((t) => t.show).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={gatedHref(to, signedIn)}
                onClick={() => triggerHaptic("impactLight")}
                className="flex flex-col items-center gap-2"
              >
                <span className="flex h-16 w-full items-center justify-center rounded-2xl bg-surface-2 text-ink transition-colors hover:bg-surface-3">
                  <Icon className="h-6 w-6" strokeWidth={1.7} />
                </span>
                <span className="text-[12px] font-medium text-ink">{label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* 6. Your bookings — signed-in only */}
        {signedIn && activeBookings.length > 0 && (
          <section aria-label="Your bookings">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-[20px] font-bold text-ink">
                Your bookings{" "}
                <span className="text-ink-tertiary">{activeBookings.length}</span>
              </h2>
              <Link
                to="/bookings"
                className="text-[14px] font-semibold text-[hsl(var(--brand-red))]"
              >
                View all
              </Link>
            </div>
            <ul className="space-y-3">
              {activeBookings.slice(0, 3).map((b) => (
                <BookingCard
                  key={b.id}
                  row={b}
                  onOpen={() => navigate(`/bookings/${b.id}`)}
                  onHide={() => {
                    if (!canHideBooking(b.status)) return;
                    setHideTarget({ kind: "booking", id: b.id, label: b.summary });
                  }}
                />
              ))}
            </ul>
          </section>
        )}

        {/* 6b. Today's plan — signed-in only, most-recent saved plan */}
        {signedIn && (
          <TodaysPlanCard
            hidden={hiddenKeys}
            onHide={(id, label) => setHideTarget({ kind: "plan", id, label })}
          />
        )}

        {/* 7. Welcome to {city} hero */}
        <WelcomeHero city={city?.name || "Shanghai"} signedIn={signedIn} />

        {/* 8. Get started */}
        <section aria-label="Get started">
          <h2 className="mb-2 text-[20px] font-bold text-ink">Get started</h2>
          <div className="grid grid-cols-3 gap-2">
            {TRANSFERS_ENABLED && (
              <ShortcutCard
                to={gatedHref("/transfers", signedIn)}
                label="Airport transfer"
                icon={Plane}
                tone="red"
              />
            )}
            <ShortcutCard
              to={gatedHref("/book/restaurant", signedIn)}
              label="Book a restaurant"
              icon={Utensils}
              tone="red"
            />
            <ShortcutCard
              to={gatedHref("/ai/plan", signedIn)}
              label="Plan my day"
              icon={Sunrise}
              tone="orange"
            />
          </div>
        </section>

        {/* 9. Recommended for you */}
        <HomeRecommendations />
      </main>

      <BottomTabBar />

      <Drawer open={!!hideTarget} onOpenChange={(o) => !o && setHideTarget(null)}>
        <DrawerContent className="border-none">
          <DrawerTitle className="sr-only">Card options</DrawerTitle>
          <div className="mx-auto w-full max-w-[440px] px-4 pb-6 pt-2">
            <div className="overflow-hidden rounded-2xl bg-white">
              <button
                type="button"
                onClick={confirmHide}
                className="flex w-full items-center gap-3 px-4 py-4 text-left text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
              >
                <EyeOff className="h-5 w-5" strokeWidth={2} />
                <span>Hide from Home</span>
              </button>
            </div>
            <button
              type="button"
              onClick={() => setHideTarget(null)}
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

// —— Local presentation components —————————————————————————————————

const NotificationBanner = ({
  title,
  detail,
  icon: Icon,
  tone,
  onOpen,
  onDismiss,
}: {
  title: string;
  detail: string;
  icon: typeof CheckCircle2;
  tone: "success" | "pending" | "error";
  onOpen: () => void;
  onDismiss: () => void;
}) => {
  const t = TONE_CLASSES[tone];
  return (
    <div className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 ${t.bg}`}>
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.dot} text-white`}
      >
        <Icon className="h-4 w-4" strokeWidth={2.2} />
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 text-left"
      >
        <p className={`text-[14px] font-semibold leading-tight ${t.text}`}>{title}</p>
        <p className={`mt-0.5 text-[12px] leading-snug ${t.text} opacity-80`}>{detail}</p>
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${t.text} opacity-70 hover:opacity-100`}
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
};

const BookingCard = ({
  row,
  onOpen,
  onHide,
}: {
  row: BookingRow;
  onOpen: () => void;
  onHide: () => void;
}) => {
  const hideable = canHideBooking(row.status);
  const Icon = categoryIcon(row.category);
  const phase = resolvePaymentPresentation(row);
  const tone = phase ? phase.toneClasses : TONE_CLASSES[statusTone(row.status)];
  const meta = row.details?.trim() || "Human assistant · usually replies in < 5 min";
  return (
    <li>
      <div className="relative flex w-full items-center gap-3 rounded-2xl border border-border bg-white p-3 transition hover:bg-surface-2/60">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-ink">
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate pr-6 text-[15px] font-semibold text-ink">{row.summary}</p>
            <p className="mt-0.5 truncate text-[12px] text-ink-secondary">{meta}</p>
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tone.bg} ${tone.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} aria-hidden />
              {phase ? phase.chipLabel : STATUS_LABEL[row.status]}
            </span>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-ink-tertiary" />
        </button>
        {hideable && (
        <button
          type="button"
          aria-label="Booking options"
          onClick={(e) => {
            e.stopPropagation();
            onHide();
          }}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-2"
        >
          <MoreHorizontal className="h-4 w-4" strokeWidth={2} />
        </button>
        )}
      </div>
    </li>
  );
};

const WelcomeHero = ({ city, signedIn }: { city: string; signedIn: boolean }) => {
  const chips: { to: string; label: string; icon: typeof ClipboardList }[] = [
    { to: gatedHref("/pretrip", signedIn), label: "Pre-trip checklist", icon: ClipboardList },
    { to: "/guides/eat-and-drink", label: "Restaurants", icon: Utensils },
    { to: "/guides/culture-and-etiquette", label: "China essentials", icon: Compass },
    { to: "/guides/getting-around", label: "Getting around", icon: Car },
  ];
  return (
    <section
      aria-label={`Welcome to ${city}`}
      className="relative overflow-hidden rounded-[20px]"
      style={{ height: 180 }}
    >
      <img
        src={shanghaiHero}
        alt={`${city} skyline`}
        className="absolute inset-0 h-full w-full object-cover object-center"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/80" />
      <div className="absolute inset-x-0 top-0 flex flex-col p-4">
        <p className="text-[13px] font-medium text-white/80">Welcome to</p>
        <h3 className="text-[26px] font-extrabold leading-tight text-white">{city}</h3>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex gap-1.5 overflow-x-auto px-3 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => triggerHaptic("impactLight")}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-black/35 px-2.5 py-1.5 backdrop-blur-md transition-colors hover:bg-black/50"
          >
            <Icon className="h-3.5 w-3.5 text-white" strokeWidth={1.9} />
            <span className="whitespace-nowrap text-[11px] font-semibold leading-none text-white">
              {label}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};

const ShortcutCard = ({
  to,
  label,
  icon: Icon,
  tone,
}: {
  to: string;
  label: string;
  icon: typeof Utensils;
  tone: "red" | "orange";
}) => {
  // Get started row is unified: brand-red icons on soft red-tint circle.
  void tone;
  const bg = "bg-[hsl(var(--error-tint))]";
  const fg = "text-[hsl(var(--brand-red))]";
  return (
    <Link
      to={to}
      onClick={() => triggerHaptic("impactLight")}
      className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-white p-3 transition-colors hover:bg-surface-2/60"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-full ${bg} ${fg}`}
      >
        <Icon className="h-5 w-5" strokeWidth={1.9} />
      </span>
      <span className="text-[13px] font-semibold leading-snug text-ink">{label}</span>
    </Link>
  );
};

export default Index;
