import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { clearUserLocalState } from "@/lib/clearUserLocalState";
import { configureRevenueCat } from "@/integrations/median/revenuecat";

export type Profile = {
  id: string;
  user_id: string;
  display_name: string | null;
  arrival_date: string | null;
  departure_date: string | null;
  destination_city: string | null;
  card_linked: boolean;
  onboarding_completed: boolean;
  interests: string[];
  welcome_completed?: boolean;
  full_name?: string | null;
  nationality?: string | null;
  phone?: string | null;
  preferred_currency?: string | null;
  dining_budget?: "budget" | "mid" | "fine" | "luxury" | null;
  spice_level?: number | null;
  dietary_needs?: string[];
  already_in_china?: boolean | null;
  profile_setup_completed?: boolean;
  pretrip_tasks_done?: string[];
  pretrip_hidden_until?: string | null;
  pretrip_dismissed?: boolean;
  hidden_from_home?: string[] | null;
  /** Set when the traveller's one free restaurant booking has been used. */
  free_booking_used_at?: string | null;
  free_booking_task_id?: string | null;
};

type AuthCtx = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => fetchProfile(s.user.id), 0);
      } else {
        setProfile(null);
      }
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) fetchProfile(s.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  // Configure RevenueCat with the Supabase user id as the app user id, and
  // again whenever the signed-in user changes. No-op outside the Median app.
  useEffect(() => {
    void configureRevenueCat(user?.id ?? null);
  }, [user?.id]);

  const signOut = async () => {
    // Revoke server-side refresh token; swallow any error so logout never fails visibly
    // (AuthSessionMissingError, network errors, etc.).
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch (err) {
      console.warn("signOut error (ignored)", err);
    }
    // Purge per-user localStorage BEFORE clearing React state so nothing re-persists.
    clearUserLocalState();
    setSession(null);
    setUser(null);
    setProfile(null);
    // Hard redirect to guarantee any cached authed screens unmount.
    // Ops sign-out should preserve the dispatch destination for the next sign-in.
    if (typeof window !== "undefined") {
      const next = window.location.pathname.startsWith("/ops") ? "/auth?next=%2Fops" : "/";
      window.location.assign(next);
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};