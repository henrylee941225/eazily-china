import { useAuth } from "@/contexts/AuthContext";

export type EntitlementTier = "none" | "trip";

/**
 * PURCHASE LOG ONLY — display hint. profiles.trip_pass_active_until is a
 * purchase log; nothing may gate restaurant booking access on it. Booking
 * access is booking_entitlements via the booking_entitlement_state RPC.
 */
export const useEntitlement = () => {
  const { profile, loading } = useAuth();

  const now = Date.now();
  const tripUntil = (profile as unknown as { trip_pass_active_until?: string | null })
    ?.trip_pass_active_until;

  const tripActive = !!tripUntil && new Date(tripUntil).getTime() > now;

  // Trip Pass v2 — real gating. Restaurant booking gets one free per user;
  // all AI features require an active pass. Server is authoritative via the
  // `has_ai_access` RPC and per-function checks; this hook reflects the same
  // profile fields the webhook writes.
  const DEMO_MODE = false;

  const tier: EntitlementTier = tripActive || DEMO_MODE ? "trip" : "none";

  return {
    loading,
    tier,
    hasAiAccess: DEMO_MODE || tripActive,
    tripActiveUntil: tripUntil ?? null,
  };
};