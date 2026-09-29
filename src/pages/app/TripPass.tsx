import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { fetchBookingAllowance, useBookingAllowance } from "@/hooks/useBookingAllowance";
import {
  canOfferCardFallback,
  classifyPurchaseError,
  detectPlatform,
  getTripPassPrice,
  TRIP_PASS_PRODUCT_IDENTIFIER,
  isRevenueCatAvailable,
  purchaseTripPass,
} from "@/integrations/median/revenuecat";
import { useRestaurantAccess } from "@/hooks/useRestaurantAccess";
import { bookingParamsForVenue, resolveVenueBySlug } from "@/lib/venueBySlug";
import { SHANGHAI_DINING } from "@/content/shanghaiDining";
import { useVenueImages } from "@/hooks/useVenueImages";

const POLL_INTERVAL_MS = 2500;
const POLL_TIMEOUT_MS = 60_000;

const WHAT_YOU_GET = [
  "We telephone the restaurant in Chinese and book the table in your name.",
  "We send you the address in Chinese characters to show your taxi driver.",
  "Included: 5 restaurant bookings for your trip.",
];

const DINING_SLUGS = SHANGHAI_DINING.map((v) => v.slug);

/** Locked preview of what the pass opens: real names and photography only. */
const VenuePreview = ({ onTap }: { onTap: () => void }) => {
  const { data: images } = useVenueImages(DINING_SLUGS);
  const withPhotos = SHANGHAI_DINING.filter((v) => images?.[v.slug]?.length).slice(0, 8);
  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">Behind the pass</p>
      <p className="mt-1 text-base font-semibold text-ink">
        {SHANGHAI_DINING.length} Shanghai restaurants, bars and cafés
      </p>
      {withPhotos.length > 0 && (
        <div className="-mx-5 mt-4 flex gap-3 overflow-x-auto px-5 pb-1">
          {withPhotos.map((v) => (
            <button
              key={v.slug}
              type="button"
              onClick={onTap}
              className="relative w-[140px] shrink-0 overflow-hidden rounded-2xl bg-surface-2 text-left active:opacity-90"
            >
              <img
                src={images![v.slug][0].url}
                alt={v.name}
                loading="lazy"
                className="h-[100px] w-full object-cover"
              />
              <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-ink/70 text-white">
                <Lock className="h-3 w-3" strokeWidth={2} />
              </span>
              <span className="block px-2.5 pb-2.5 pt-2">
                <span className="block truncate text-[13px] font-semibold text-ink">{v.name}</span>
                {v.name_zh && <span className="block truncate text-[12px] text-ink-secondary">{v.name_zh}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-3 text-[13px] leading-snug text-ink-secondary">
        Venue details and booking open once your pass is active.
      </p>
    </div>
  );
};

type Phase =
  | { kind: "idle" }
  | { kind: "purchasing" }
  | { kind: "confirming" }
  | { kind: "unconfirmed"; reference: string | null }
  | { kind: "error"; message: string };

const FAILURE_COPY: Record<string, string> = {
  cancelled: "Purchase cancelled. Nothing was charged.",
  declined: "The App Store couldn't take payment. Check your payment method in Settings, then try again.",
  store_unavailable: "The App Store isn't available right now. Please try again in a moment.",
  already_owned: "The App Store says you already own this. Use Restore purchases in Account to bring it back.",
  pending: "Your payment is waiting for approval in the App Store. We'll activate your pass as soon as it goes through.",
  generic: "We couldn't complete the purchase. Nothing extra was charged — please try again.",
  active: "You already have an active Trip Pass, so there's nothing to buy.",
};

// Server-side diagnostics; never blocks the UI.
const reportToServer = async (body: Record<string, unknown>): Promise<string | null> => {
  try {
    const { data } = await supabase.functions.invoke("store-purchase-report", {
      body: { product_id: TRIP_PASS_PRODUCT_IDENTIFIER, platform: detectPlatform(), ...body },
    });
    return (data as { reference?: string | null } | null)?.reference ?? null;
  } catch {
    return null;
  }
};

const formatDate = (d: string | null) => (d ? format(new Date(d), "d MMM yyyy") : "the end of your trip");

const TripPass = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next");
  const venue = resolveVenueBySlug(params.get("venue"));
  const cleanNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  // After buying, go where they were heading — or straight to the named venue.
  const safeNext = cleanNext ?? (venue ? `/book/restaurant?${bookingParamsForVenue(venue)}` : null);
  const { access, refetch: refetchAccess } = useRestaurantAccess();
  const topRef = useRef<HTMLDivElement | null>(null);
  const { user, profile } = useAuth();
  const { allowance, loading, refresh } = useBookingAllowance();
  const storeAvailable = isRevenueCatAvailable();
  const [price, setPrice] = useState<string | null>(null);
  const [priceLoading, setPriceLoading] = useState(storeAvailable);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const pollRef = useRef<number | null>(null);
  const txRef = useRef<string | undefined>(undefined);
  const reportedRef = useRef(false);
  // Card fallback only on a confident browser detection; anything else is native.
  const allowCard = !storeAvailable && canOfferCardFallback();


  useEffect(() => {
    if (!storeAvailable || !user?.id) return;
    let cancelled = false;
    getTripPassPrice(user.id).then((p) => {
      if (cancelled) return;
      setPrice(p);
      setPriceLoading(false);
    });
    return () => { cancelled = true; };
  }, [storeAvailable, user?.id]);

  useEffect(() => () => { if (pollRef.current) window.clearTimeout(pollRef.current); }, []);

  const pollForAllowance = (startedAt: number) => {
    if (!user?.id) return;
    pollRef.current = window.setTimeout(async () => {
      const a = await fetchBookingAllowance(user.id).catch(() => null);
      if (a) {
        await refresh();
        void refetchAccess();
        setPhase({ kind: "idle" });
        if (safeNext) navigate(safeNext, { replace: true });
        return;
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (!reportedRef.current) {
          reportedRef.current = true;
          setPhase({ kind: "unconfirmed", reference: null });
          const reference = await reportToServer({ kind: "unconfirmed", transaction_id: txRef.current ?? null });
          setPhase({ kind: "unconfirmed", reference });
        } else {
          setPhase((p) => (p.kind === "unconfirmed" ? p : { kind: "unconfirmed", reference: null }));
        }
        return;
      }
      pollForAllowance(startedAt);
    }, POLL_INTERVAL_MS);
  };

  const handlePurchase = async () => {
    if (!user?.id) { navigate("/auth"); return; }
    // Re-check the server immediately before selling — never overlap a pass.
    const existing = await fetchBookingAllowance(user.id).catch(() => null);
    if (existing) {
      await refresh();
      setPhase({ kind: "error", message: FAILURE_COPY.active });
      return;
    }
    setPhase({ kind: "purchasing" });
    const res = await purchaseTripPass(user.id);
    if (!res.success) {
      const kind = classifyPurchaseError(res.code, res.raw ?? res.error);
      void reportToServer({ kind: "purchase_error", code: res.code ?? null, classified: kind, raw_error: res.raw ?? res.error ?? null });
      setPhase({ kind: "error", message: FAILURE_COPY[kind] ?? FAILURE_COPY.generic });
      return;
    }
    txRef.current = res.transactionId;
    setPhase({ kind: "confirming" });
    pollForAllowance(Date.now());
  };

  const checkAgain = () => {
    setPhase({ kind: "confirming" });
    pollForAllowance(Date.now());
  };

  const busy = phase.kind === "purchasing" || phase.kind === "confirming";

  return (
    <AppLayout title="Trip Pass" subtitle="Restaurant bookings for your trip" showBack backTo={safeNext ? "/" : "/account"}>
      <div ref={topRef} className="mx-auto w-full max-w-[440px] space-y-4">
        <div className="rounded-2xl border border-hairline bg-surface p-5">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-tint-warm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
            <Sparkles className="h-3 w-3 text-brand-orange" strokeWidth={2} fill="currentColor" />
            Trip Pass
          </div>
          <h2 className="font-display mt-4 text-[28px] font-extrabold leading-[1.15] text-ink">
            {venue
              ? `Book ${venue.name}${venue.nameZh ? ` ${venue.nameZh}` : ""} with Trip Pass`
              : "Restaurant bookings in Shanghai, done for you"}
          </h2>
          <p className="mt-2 text-[15px] leading-[1.45] text-ink-secondary">
            Most Shanghai restaurants won't take a booking from a foreign phone number. We make the call for you.
          </p>
          <ul className="mt-4 space-y-3">
            {WHAT_YOU_GET.map((line) => (
              <li key={line} className="flex items-start gap-3 text-[15px] leading-snug text-ink/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-white">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {line}
              </li>
            ))}
          </ul>
        </div>

        {access?.freeBookingAvailable && !access.hasPass && (
          <div className="rounded-2xl bg-tint-warm p-4">
            <p className="text-[14px] font-semibold text-ink">You still have one free booking</p>
            <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
              It came with your account from before Trip Pass. Use it any time.
            </p>
            <button
              type="button"
              onClick={() => navigate(safeNext ?? "/guides/eat-and-drink/directory?entity=restaurant")}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-white active:opacity-90"
            >
              Use my free booking
            </button>
          </div>
        )}

        {!user ? (
          <button
            type="button"
            onClick={() => navigate(`/auth?next=${encodeURIComponent(`/trip-pass?${params.toString()}`)}`)}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white active:opacity-90"
          >
            Log in to get Trip Pass
          </button>
        ) : loading ? (
          <div className="flex h-[52px] items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
          </div>
        ) : allowance ? (
          <div className="rounded-2xl border border-hairline bg-surface p-5">
            <div className="inline-flex rounded-full bg-success-tint px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-success">
              Active
            </div>
            <p className="mt-3 text-base font-semibold text-ink">
              {allowance.remaining} of {allowance.maxBookings} bookings left
            </p>
            <p className="mt-1 text-[13px] font-medium text-ink-secondary">
              Valid until {formatDate(allowance.validUntil)}
            </p>
            {safeNext && (
              <button
                type="button"
                onClick={() => navigate(safeNext, { replace: true })}
                className="mt-4 flex h-[52px] w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-white active:opacity-90"
              >
                Continue to booking
              </button>
            )}
          </div>
        ) : !storeAvailable ? (
          // Median bridge absent (a browser, or the app without store setup).
          <div className="space-y-3">
            <div className="rounded-2xl bg-surface-2 p-5">
              <p className="text-base font-semibold text-ink">Trip Pass is sold in the eazilyChina app</p>
              <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                Open the app on your iPhone to buy it through the App Store.
                {allowCard && safeNext
                  ? " Or carry on here and pay the booking fee by card when your request is ready."
                  : allowCard
                    ? ""
                    : " If you're already in the app, please update it to the latest version, or message our team and we'll help."}
              </p>
            </div>
            {!allowCard && (
              <button
                type="button"
                onClick={() => navigate("/concierge/chat")}
                className="flex h-[52px] w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink active:bg-surface-3"
              >
                Message our team
              </button>
            )}
            {allowCard && safeNext && (
              <button
                type="button"
                onClick={() => {
                  const sep = safeNext.includes("?") ? "&" : "?";
                  navigate(`${safeNext}${sep}pass=card`, { replace: true });
                }}
                className="flex h-[52px] w-full items-center justify-center rounded-full bg-surface-2 text-[15px] font-semibold text-ink active:bg-surface-3"
              >
                Continue and pay by card
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {phase.kind === "confirming" && (
              <div className="flex items-start gap-3 rounded-2xl bg-tint-warm p-4">
                <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-ink" />
                <p className="text-[14px] leading-snug text-ink">
                  Confirming your pass with the App Store — this usually takes a few seconds.
                </p>
              </div>
            )}
            {phase.kind === "unconfirmed" && (
              <div className="rounded-2xl bg-tint-warm p-4">
                <p className="text-[14px] font-semibold text-ink">Your payment went through</p>
                <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
                  We can see your purchase, but your pass hasn't switched on yet. Our team has been alerted and is
                  fixing it now — please don't buy it again.
                  {phase.reference ? ` Reference ${phase.reference.slice(0, 8).toUpperCase()}.` : ""}
                </p>
                <button
                  type="button"
                  onClick={() => navigate("/concierge/chat")}
                  className="mt-3 flex h-11 w-full items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-white active:opacity-90"
                >
                  Message our team
                </button>
                <button
                  type="button"
                  onClick={checkAgain}
                  className="mt-2 flex h-11 w-full items-center justify-center rounded-full bg-white text-[14px] font-semibold text-ink"
                >
                  Check again
                </button>
              </div>
            )}
            {phase.kind === "error" && (
              <p className="rounded-2xl bg-error-tint p-4 text-[14px] leading-snug text-brand-red">{phase.message}</p>
            )}
            {phase.kind !== "unconfirmed" && (
              <button
                type="button"
                onClick={handlePurchase}
                disabled={busy || priceLoading || !price}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-semibold text-white transition active:opacity-90 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {priceLoading
                  ? "Loading price…"
                  : price
                    ? `Buy Trip Pass · ${price}`
                    : "Trip Pass unavailable right now"}
              </button>
            )}
            {!priceLoading && !price && (
              <p className="text-[13px] leading-snug text-ink-secondary">
                We couldn't reach the App Store. Check your connection and reopen this screen.
              </p>
            )}
            <p className="text-[13px] leading-snug text-ink-secondary">
              Paid once through the App Store and charged when you buy. It covers 5 restaurant bookings for your
              trip.
            </p>
          </div>
        )}

        {!allowance && (
          <VenuePreview onTap={() => topRef.current?.scrollIntoView({ behavior: "smooth" })} />
        )}
      </div>
    </AppLayout>
  );
};

export default TripPass;
