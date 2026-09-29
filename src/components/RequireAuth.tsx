import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

/**
 * When true, disables ALL auth gating so every route renders for guests.
 * Intended for local demos only. MUST be false in production.
 */
const AUTH_DISABLED_FOR_DEMO = false;

/**
 * Route guard. Requires a session by default and, when `requireOnboarded` is true,
 * that the user has completed profile setup (`profile_setup_completed`).
 * Pass `requireOnboarded={false}` for routes that must be reachable during
 * setup itself (e.g. /profile-setup, /onboarding).
 * Pass `mode="optional"` to allow guests while still hydrating auth context.
 */
export const RequireAuth = ({
  children,
  requireOnboarded = true,
  mode = "required",
}: {
  children: ReactNode;
  requireOnboarded?: boolean;
  mode?: "required" | "optional";
}) => {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (AUTH_DISABLED_FOR_DEMO) return <>{children}</>;

  if (loading) return null;
  if (mode === "optional") return <>{children}</>;
  if (!session) {
    const next = encodeURIComponent(location.pathname + location.search);
    if (location.pathname.startsWith("/ops")) {
      console.info("[ops signup trace] require-auth signed-out redirect", {
        from: location.pathname + location.search,
        to: `/auth?next=${next}`,
      });
    }
    return <Navigate to={`/auth?next=${next}`} replace state={{ from: location.pathname }} />;
  }
  if (requireOnboarded && profile && !profile.profile_setup_completed) {
    const next = encodeURIComponent(location.pathname + location.search);
    const to =
      location.pathname === "/" || location.pathname.startsWith("/profile-setup")
        ? "/profile-setup"
        : `/profile-setup?next=${next}`;
    if (location.pathname.startsWith("/ops")) {
      console.info("[ops signup trace] require-auth profile gate redirect", {
        from: location.pathname + location.search,
        to,
      });
    }
    return <Navigate to={to} replace />;
  }
  return <>{children}</>;
};