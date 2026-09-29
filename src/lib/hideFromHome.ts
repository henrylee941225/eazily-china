import { supabase } from "@/integrations/supabase/client";
import type { ConciergeStatus } from "@/lib/conciergeStatus";

// Namespaced Home-hub dismissal IDs. Keep the namespaces here so both the
// booking and plan card code paths use the same shape.
export const bookingHideId = (id: string) => `booking:${id}`;
export const planHideId = (id: string) => `plan:${id}`;

// Statuses that must reappear on Home even after the user hid the card —
// hiding declutters, it must never suppress something actionable.
export const SAFETY_VALVE_STATUSES: ConciergeStatus[] = [
  "pay_to_confirm",
  "unavailable",
  "change_pending",
];

// A booking can only be hidden when the safety valve does not force it back.
export const canHideBooking = (status: ConciergeStatus): boolean =>
  !SAFETY_VALVE_STATUSES.includes(status);

export const isBookingSuppressed = (
  hidden: string[] | null | undefined,
  bookingId: string,
  status: ConciergeStatus,
): boolean => {
  if (SAFETY_VALVE_STATUSES.includes(status)) return false;
  return (hidden ?? []).includes(bookingHideId(bookingId));
};

export const isPlanSuppressed = (
  hidden: string[] | null | undefined,
  planId: string,
): boolean => (hidden ?? []).includes(planHideId(planId));

export const hideFromHome = async (userId: string, key: string, current: string[] | null | undefined) => {
  const next = Array.from(new Set([...(current ?? []), key]));
  return supabase.from("profiles").update({ hidden_from_home: next } as any).eq("user_id", userId);
};
export const unhideFromHome = async (userId: string, key: string, current: string[] | null | undefined) => {
  const next = (current ?? []).filter((k) => k !== key);
  return supabase.from("profiles").update({ hidden_from_home: next } as any).eq("user_id", userId);
};
