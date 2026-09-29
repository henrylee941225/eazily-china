import { ReactNode } from "react";
import { Navigate, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useRestaurantAccess } from "@/hooks/useRestaurantAccess";
import { canOfferCardFallback } from "@/integrations/median/revenuecat";

/**
 * Front door to the whole restaurant section (directory, bars, nightlife,
 * booking form, "Help me choose"). Without an active pass or a grandfathered
 * free booking, every entry lands on /trip-pass — with the venue named when
 * the link pointed at one. The server re-checks on submit.
 */
export const RestaurantGate = ({ children }: { children: ReactNode }) => {
  const { loading, allowed, error } = useRestaurantAccess();
  const location = useLocation();
  const [params] = useSearchParams();
  const { slug } = useParams();

  // Web card fallback chosen on /trip-pass: the booking fee hold creates the pass.
  const cardBypass =
    location.pathname === "/book/restaurant" && params.get("pass") === "card" && canOfferCardFallback();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-ink-secondary" />
      </div>
    );
  }
  if (allowed || cardBypass) return <>{children}</>;

  const venue = params.get("venueSlug") ?? params.get("venue") ?? slug ?? null;
  const q = new URLSearchParams();
  q.set("next", location.pathname + location.search);
  if (venue) q.set("venue", venue);
  if (error) q.set("check", "failed");
  return <Navigate to={`/trip-pass?${q.toString()}`} replace />;
};
