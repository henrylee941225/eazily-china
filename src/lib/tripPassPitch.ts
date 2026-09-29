/**
 * The Trip Pass pitch copy, shown at the moment of success — when the
 * traveller's first (free) restaurant booking is confirmed and they hold no
 * active pass. Mirrors supabase/functions/_shared/tripPassPitch.ts.
 */
export const TRIP_PASS_PITCH =
  "That's your first booking, on us. Trip Pass adds five more restaurant bookings for the rest of your trip — you'll find it in the app, priced by the App Store.";

/** Second request onwards with no pass — acknowledges the history. */
export const TRIP_PASS_RETURNING_INTRO = "Your first booking was on us.";
export const TRIP_PASS_RETURNING_LEAD = "To keep going, activate your Trip Pass.";
