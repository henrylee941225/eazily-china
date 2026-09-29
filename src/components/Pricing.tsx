import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getTripPassPrice } from "@/integrations/median/revenuecat";
import { Check, Sparkles } from "lucide-react";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BottomTabBar } from "@/components/BottomTabBar";

// Explanation screen — nothing is sold here. Bookings are charged at the
// point of request; transfers are priced per journey.
const FREE = [
  "Concierge chat — ask anything, in your language.",
  "Recommendations — restaurants, bars and sights matched to your tastes.",
  "Plan My Day — day-by-day itineraries built from places we've checked.",
  "Translate, Maps and our Shanghai guides.",
];

const PAID = [
  {
    title: "Restaurant bookings",
    price: null as string | null,
    body:
      "Your first restaurant booking is free. After that, Trip Pass covers five more for your trip. We telephone the restaurant in Chinese and book in your name.",
  },
  {
    title: "Private transfers",
    price: "Per journey",
    body:
      "Airport, station and hourly cars are quoted per journey before you request them. You see the price first.",
  },
];

export const Pricing = () => {
  const { user } = useAuth();
  // Price comes from the store; with no store (web) we show no number.
  const [storePrice, setStorePrice] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    getTripPassPrice(user?.id).then((p) => { if (!cancelled) setStorePrice(p); });
    return () => { cancelled = true; };
  }, [user?.id]);
  return (
  <>
    <div
      className="fixed inset-x-0 top-0 z-30 flex flex-col bg-white"
      style={{ bottom: "var(--nav-inset)" }}
    >
      <ScreenHeader title="What things cost" showBack backTo="/" />

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <section className="mx-auto max-w-xl px-5 py-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-tint-warm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink">
            <Sparkles className="h-3 w-3 text-brand-orange" strokeWidth={2} />
            Booking service
          </div>
          <h1 className="font-display mt-4 text-[28px] font-extrabold leading-[1.15] text-ink">
            Your concierge is free. Your first booking is on us.
          </h1>
          <p className="mt-2 text-[15px] leading-snug text-ink-secondary">
            Ask us anything about your trip at no cost. Your first restaurant booking is free, so you
            can see how it works before paying. After that, Trip Pass covers five more bookings for
            your trip.
          </p>

          <div className="mt-6 rounded-2xl border border-hairline bg-surface p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-secondary">
              Free for everyone
            </div>
            <ul className="mt-4 space-y-3">
              {FREE.map((text) => {
                const [bold, rest] = text.split(" — ");
                return (
                  <li key={text} className="flex items-start gap-3 text-[15px]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-cream">
                      <Check className="h-3 w-3" strokeWidth={3} />
                    </span>
                    <span className="leading-snug text-ink/85">
                      <span className="font-semibold text-ink">{bold}</span>
                      {rest ? ` — ${rest}` : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4 space-y-3">
            {PAID.map((item) => (
              <div key={item.title} className="rounded-2xl border border-hairline bg-surface p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-semibold text-ink">{item.title}</span>
                  <span className="font-display text-[20px] font-extrabold text-ink">
                    {item.title === "Restaurant bookings" ? storePrice ?? "In the app" : item.price}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-snug text-ink-secondary">{item.body}</p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[13px] leading-snug text-ink-secondary">
            There's nothing to buy on this screen — Trip Pass is bought in the app. Your trip dates
            live in{" "}
            <Link to="/account/trip" className="text-brand-red underline underline-offset-2">
              Account
            </Link>{" "}
            and help us make better suggestions.
          </p>
          <p className="mt-3 text-[11px] leading-snug text-ink-tertiary">
            Restaurant and transfer requests are subject to our{" "}
            <Link to="/legal/terms" className="underline underline-offset-2 hover:text-ink">
              Terms &amp; Conditions
            </Link>
            .
          </p>
        </section>
      </div>
    </div>

    <BottomTabBar />
  </>
);
};
