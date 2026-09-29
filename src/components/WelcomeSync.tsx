import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Bridges the guest first-launch welcome tour to the user's profile:
 *   - When a user signs in and their local device shows the tour as
 *     completed but the profile flag isn't set yet, mirror it to the
 *     profile so other devices skip the tour.
 *   - When the profile already reports completion, cache it locally
 *     so subsequent guest sessions on this device skip it too.
 *
 * Purely a background sync. Does not render anything and does not
 * interfere with any other auth or routing logic.
 */
const LS_KEY = "eazilychina:welcomeCompleted";

export const WelcomeSync = () => {
  const { user, profile, refreshProfile } = useAuth();
  const wroteRef = useRef(false);

  useEffect(() => {
    if (!user || !profile) return;
    const localDone = (() => {
      try { return localStorage.getItem(LS_KEY) === "true"; } catch { return false; }
    })();

    if (profile.welcome_completed) {
      if (!localDone) {
        try { localStorage.setItem(LS_KEY, "true"); } catch { /* ignore */ }
      }
      return;
    }

    if (localDone && !wroteRef.current) {
      wroteRef.current = true;
      supabase
        .from("profiles")
        .update({ welcome_completed: true })
        .eq("user_id", user.id)
        .then(({ error }) => {
          if (error) {
            wroteRef.current = false;
            return;
          }
          refreshProfile();
        });
    }
  }, [user, profile, refreshProfile]);

  return null;
};