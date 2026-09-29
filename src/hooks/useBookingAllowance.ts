import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type BookingAllowance = {
  id: string;
  remaining: number;
  maxBookings: number;
  validUntil: string | null;
};

/**
 * Reads the active restaurant booking allowance from the server
 * (booking_entitlement_state). Never derived from local state.
 */
export const fetchBookingAllowance = async (userId: string): Promise<BookingAllowance | null> => {
  const { data, error } = await supabase.rpc("booking_entitlement_state", { user_uuid: userId });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.id) return null;
  return {
    id: row.id,
    maxBookings: row.max_bookings,
    remaining: Math.max(0, row.max_bookings - row.confirmed_count),
    validUntil: row.valid_until,
  };
};

export const useBookingAllowance = () => {
  const { user } = useAuth();
  const [allowance, setAllowance] = useState<BookingAllowance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!user?.id) { setAllowance(null); setLoading(false); return null; }
    try {
      const a = await fetchBookingAllowance(user.id);
      setAllowance(a);
      setError(false);
      return a;
    } catch {
      setError(true);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { allowance, loading, error, refresh };
};
