import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Shown when the traveller's active booking allowance was given a default
 * 60-day window because no trip dates were set. Saving dates realigns it
 * server-side.
 */
export const TripDatesNudge = ({ className = "" }: { className?: string }) => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user?.id) { setShow(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc("booking_entitlement_state", { user_uuid: user.id });
      const row = Array.isArray(data) ? data[0] : data;
      if (!cancelled) setShow(!!(row as { trip_dates_defaulted?: boolean } | null)?.trip_dates_defaulted);
    })();
    return () => { cancelled = true; };
  }, [user?.id, profile?.departure_date]);

  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => navigate("/account/trip")}
      className={`flex w-full items-center gap-3 rounded-2xl bg-tint-warm p-4 text-left transition active:opacity-90 ${className}`}
    >
      <CalendarDays className="h-5 w-5 shrink-0 text-brand-orange" strokeWidth={1.75} />
      <span className="flex-1 text-[15px] leading-snug text-ink">
        Add your trip dates so your bookings cover the right days.
      </span>
      <ChevronRight className="h-4 w-4 text-ink-secondary" strokeWidth={2} />
    </button>
  );
};
