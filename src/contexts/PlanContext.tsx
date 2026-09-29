import { createContext, useContext, useState, ReactNode } from "react";
import { Outlet } from "react-router-dom";
import type { ShanghaiAreaId } from "@/data/shanghaiAreas";

export type TimeBudget = "2h" | "4h" | "6h" | "full" | "custom";
export type Mood = "foodie" | "culture" | "slow" | "buzzy" | "photo";

/** Wizard duration — coarser than TimeBudget; drives step routing. */
export type WizardDuration = "morning" | "afternoon" | "full";

/** A venue selected from a recommend-stops response. */
export type RecommendedStop = {
  id: string;
  name: string;
  name_zh?: string;
  district?: string;
  category?: string;
  blurb?: string;
  reason: string;
  durationMinutes: number;
};

export type LunchPrefs = {
  skip: boolean;
  cuisines: string[];
  budget: 1 | 2 | 3 | null;
  vibes: string[];
};

export type PlanStop = {
  startTime: string;
  durationMinutes: number;
  placeName: string;
  neighbourhood: string;
  reason: string;
  walkingMinutesToNext: number;
  isUserEdited?: boolean;
  /** Follow-along: user has ticked this stop as done. Persisted in
   *  saved_plans.plan JSONB — no schema change. */
  done?: boolean;
};

export type GeneratedPlan = {
  title: string;
  totalHours: number;
  totalDistanceKm: number;
  stops: PlanStop[];
};

// Server expects these mood slugs.
export const MOOD_TO_API: Record<Mood, "foodie" | "culture" | "slow" | "buzzy" | "photographer"> = {
  foodie: "foodie",
  culture: "culture",
  slow: "slow",
  buzzy: "buzzy",
  photo: "photographer",
};

export const resolveHours = (budget: TimeBudget | null, custom: number): number => {
  switch (budget) {
    case "2h": return 2;
    case "4h": return 4;
    case "6h": return 6;
    case "full": return 9;
    case "custom": return custom;
    default: return 0;
  }
};

type PlanState = {
  timeBudget: TimeBudget | null;
  customHours: number;
  mood: Mood | null;
  plan: GeneratedPlan | null;
  savedPlanId: string | null;
  setTimeBudget: (t: TimeBudget | null) => void;
  setCustomHours: (n: number) => void;
  setMood: (m: Mood | null) => void;
  setPlan: (p: GeneratedPlan | null) => void;
  setSavedPlanId: (id: string | null) => void;
  // Wizard state
  duration: WizardDuration | null;
  areas: ShanghaiAreaId[];
  wantBreakfast: boolean | null;
  cafe: RecommendedStop | null;
  morningActivities: RecommendedStop[];
  lunchPrefs: LunchPrefs;
  lunch: RecommendedStop | null;
  afternoonActivities: RecommendedStop[];
  setDuration: (d: WizardDuration | null) => void;
  setAreas: (a: ShanghaiAreaId[]) => void;
  setWantBreakfast: (v: boolean | null) => void;
  setCafe: (s: RecommendedStop | null) => void;
  setMorningActivities: (s: RecommendedStop[]) => void;
  setLunchPrefs: (p: LunchPrefs) => void;
  setLunch: (s: RecommendedStop | null) => void;
  setAfternoonActivities: (s: RecommendedStop[]) => void;
  resetWizard: () => void;
};

const EMPTY_LUNCH_PREFS: LunchPrefs = {
  skip: false,
  cuisines: [],
  budget: null,
  vibes: [],
};

const PlanCtx = createContext<PlanState | null>(null);

export const PlanProvider = ({ children }: { children: ReactNode }) => {
  const [timeBudget, setTimeBudget] = useState<TimeBudget | null>(null);
  const [customHours, setCustomHours] = useState<number>(6);
  const [mood, setMood] = useState<Mood | null>(null);
  const [plan, setPlan] = useState<GeneratedPlan | null>(null);
  const [savedPlanId, setSavedPlanId] = useState<string | null>(null);
  const [duration, setDuration] = useState<WizardDuration | null>(null);
  const [areas, setAreas] = useState<ShanghaiAreaId[]>([]);
  const [wantBreakfast, setWantBreakfast] = useState<boolean | null>(null);
  const [cafe, setCafe] = useState<RecommendedStop | null>(null);
  const [morningActivities, setMorningActivities] = useState<RecommendedStop[]>([]);
  const [lunchPrefs, setLunchPrefs] = useState<LunchPrefs>(EMPTY_LUNCH_PREFS);
  const [lunch, setLunch] = useState<RecommendedStop | null>(null);
  const [afternoonActivities, setAfternoonActivities] = useState<RecommendedStop[]>([]);

  const resetWizard = () => {
    setDuration(null);
    setAreas([]);
    setWantBreakfast(null);
    setCafe(null);
    setMorningActivities([]);
    setLunchPrefs(EMPTY_LUNCH_PREFS);
    setLunch(null);
    setAfternoonActivities([]);
    setTimeBudget(null);
    setMood(null);
    setPlan(null);
    setSavedPlanId(null);
  };

  return (
    <PlanCtx.Provider
      value={{
        timeBudget, customHours, mood, plan, savedPlanId,
        setTimeBudget, setCustomHours, setMood, setPlan, setSavedPlanId,
        duration, areas, wantBreakfast, cafe, morningActivities,
        lunchPrefs, lunch, afternoonActivities,
        setDuration, setAreas, setWantBreakfast, setCafe, setMorningActivities,
        setLunchPrefs, setLunch, setAfternoonActivities, resetWizard,
      }}
    >
      {children}
    </PlanCtx.Provider>
  );
};

/** Kept for backwards-compat with existing route configuration. The
 *  PlanProvider is now mounted globally in App.tsx so PlanContext is
 *  reachable from Bookings, Home and elsewhere; this component now just
 *  renders the nested routes. */
export const PlanLayout = () => <Outlet />;

export const usePlan = () => {
  const ctx = useContext(PlanCtx);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
};