import type {
  GeneratedPlan,
  PlanStop,
  RecommendedStop,
  WizardDuration,
} from "@/contexts/PlanContext";
import type { ShanghaiAreaId } from "@/data/shanghaiAreas";
import { SHANGHAI_AREA_BY_ID } from "@/data/shanghaiAreas";

const WALK_KMH = 4.5;
const SAME_AREA_WALK_MIN = 5;
const CROSS_AREA_WALK_MIN = 12;

const pad = (n: number) => n.toString().padStart(2, "0");

const addMinutes = (hhmm: string, mins: number): string => {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + mins;
  const hh = Math.floor(total / 60) % 24;
  const mm = total % 60;
  return `${pad(hh)}:${pad(mm)}`;
};

const startFor = (d: WizardDuration | null): string =>
  d === "afternoon" ? "13:00" : "09:00";

export type WizardSelections = {
  duration: WizardDuration | null;
  areas: ShanghaiAreaId[];
  cafe: RecommendedStop | null;
  morningActivities: RecommendedStop[];
  lunch: RecommendedStop | null;
  afternoonActivities: RecommendedStop[];
};

/** Collect every previously-chosen venue id so subsequent recommend-stops
 *  calls exclude them via the `exclude` parameter. */
export const chosenIds = (s: WizardSelections): string[] => {
  const ids: string[] = [];
  if (s.cafe) ids.push(s.cafe.id);
  for (const v of s.morningActivities) ids.push(v.id);
  if (s.lunch) ids.push(s.lunch.id);
  for (const v of s.afternoonActivities) ids.push(v.id);
  return ids;
};

const orderedStops = (s: WizardSelections): RecommendedStop[] => {
  const stops: RecommendedStop[] = [];
  if (s.cafe) stops.push(s.cafe);
  stops.push(...s.morningActivities);
  if (s.lunch) stops.push(s.lunch);
  stops.push(...s.afternoonActivities);
  return stops;
};

const walkBetween = (a: RecommendedStop, b: RecommendedStop): number =>
  a.district && b.district && a.district === b.district
    ? SAME_AREA_WALK_MIN
    : CROSS_AREA_WALK_MIN;

const titleFor = (areas: ShanghaiAreaId[]): string => {
  const first = areas[0];
  const meta = first ? SHANGHAI_AREA_BY_ID[first] : undefined;
  return meta ? `Your day ${meta.titleSuffix}` : "Your day";
};

/** Compose a placeName without duplicating the English name when the
 *  Chinese name is missing or identical (case-insensitive). */
const composePlaceName = (name: string, zh?: string): string => {
  if (!zh) return name;
  const trimmed = zh.trim();
  if (!trimmed) return name;
  if (trimmed.toLowerCase() === name.trim().toLowerCase()) return name;
  return `${name} ${trimmed}`;
};

/** Pure — assemble a GeneratedPlan compatible with PlanResult from wizard
 *  selections. Walking estimates are honest constants (no fabricated GPS
 *  distance): same-area 5 min, cross-area 12 min. */
export const assembleWizardPlan = (s: WizardSelections): GeneratedPlan => {
  const ordered = orderedStops(s);
  if (ordered.length === 0) {
    return { title: titleFor(s.areas), totalHours: 0, totalDistanceKm: 0, stops: [] };
  }

  const stops: PlanStop[] = [];
  let cursor = startFor(s.duration);
  for (let i = 0; i < ordered.length; i += 1) {
    const stop = ordered[i];
    const next = ordered[i + 1];
    const walk = next ? walkBetween(stop, next) : 0;
    stops.push({
      startTime: cursor,
      durationMinutes: stop.durationMinutes,
      placeName: stop.name,
      neighbourhood: stop.district ?? "",
      reason: stop.reason,
      walkingMinutesToNext: walk,
    });
    cursor = addMinutes(cursor, stop.durationMinutes + walk);
  }

  const totalMinutes = stops.reduce(
    (sum, st, i) =>
      sum + st.durationMinutes + (i < stops.length - 1 ? st.walkingMinutesToNext : 0),
    0,
  );
  const walkMinutes = stops.reduce(
    (sum, st, i) => sum + (i < stops.length - 1 ? st.walkingMinutesToNext : 0),
    0,
  );

  return {
    title: titleFor(s.areas),
    stops,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalDistanceKm: Math.round((walkMinutes / 60) * WALK_KMH * 10) / 10,
  };
};