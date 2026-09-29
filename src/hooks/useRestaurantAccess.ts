import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type RestaurantAccess = { hasPass: boolean; freeBookingAvailable: boolean };

/** Server-decided access to the restaurant section. Never derived locally. */
export const useRestaurantAccess = () => {
  const { user, loading: authLoading } = useAuth();
  const q = useQuery<RestaurantAccess>({
    queryKey: ["restaurant-access", user?.id],
    enabled: !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("restaurant_access_state", { user_uuid: user!.id });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return { hasPass: !!row?.has_pass, freeBookingAvailable: !!row?.free_booking_available };
    },
  });
  const signedIn = !!user?.id;
  return {
    signedIn,
    loading: authLoading || (signedIn && q.isLoading),
    error: q.isError,
    access: signedIn ? q.data ?? null : null,
    allowed: !!q.data && (q.data.hasPass || q.data.freeBookingAvailable),
    refetch: q.refetch,
  };
};
