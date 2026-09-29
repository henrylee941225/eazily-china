import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCity } from "@/contexts/CityContext";
import { usePlan, type RecommendedStop } from "@/contexts/PlanContext";
import { buildCandidateVenues } from "@/lib/wizardVenues";
import { chosenIds } from "@/lib/planAssembly";

type Slot = "breakfast" | "morning" | "lunch" | "afternoon";

type Options = {
  slot: Slot;
  count?: number;
  preferences?: Record<string, unknown>;
  /** When true, area filter is dropped — used by the "Look in nearby areas"
   *  fallback on empty results. */
  ignoreAreas?: boolean;
  /** When false, the hook waits (used to defer until the user acts). */
  enabled?: boolean;
};

type State = {
  loading: boolean;
  picks: RecommendedStop[];
  candidatePool: number;
  error: string | null;
};

/** Wraps the recommend-stops edge function with candidate-venue assembly,
 *  exclude threading, and a stable refetch handle. */
export const useRecommendStops = ({
  slot,
  count = 3,
  preferences,
  ignoreAreas = false,
  enabled = true,
}: Options) => {
  const { city } = useCity();
  const plan = usePlan();
  const [state, setState] = useState<State>({
    loading: enabled,
    picks: [],
    candidatePool: 0,
    error: null,
  });
  // Serialise fetches so a rapid re-render can't race an in-flight call.
  const seq = useRef(0);

  const run = useCallback(
    async (overrideIgnoreAreas?: boolean) => {
      const mine = ++seq.current;
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const venues = buildCandidateVenues(city.picks);
        const exclude = chosenIds(plan);
        const useIgnore = overrideIgnoreAreas ?? ignoreAreas;
        const body: Record<string, unknown> = {
          city: city.name,
          slot,
          count,
          areas: useIgnore ? [] : plan.areas,
          venues,
          exclude,
        };
        if (preferences && Object.keys(preferences).length > 0) {
          body.preferences = preferences;
        }
        const { data, error } = await supabase.functions.invoke("recommend-stops", {
          body,
        });
        if (mine !== seq.current) return;
        if (error) throw error;
        setState({
          loading: false,
          picks: Array.isArray(data?.picks) ? (data.picks as RecommendedStop[]) : [],
          candidatePool: Number(data?.candidate_pool ?? 0),
          error: null,
        });
      } catch (e) {
        if (mine !== seq.current) return;
        setState({
          loading: false,
          picks: [],
          candidatePool: 0,
          error: e instanceof Error ? e.message : "unknown_error",
        });
      }
    },
    // `plan` and `preferences` are read via closure so callers can invoke
    // refetch without triggering re-subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [city.name, slot, count, ignoreAreas],
  );

  useEffect(() => {
    if (!enabled) return;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, city.name, slot]);

  return { ...state, refetch: run };
};