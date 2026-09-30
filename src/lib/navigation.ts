import { lineString, point, length, nearestPointOnLine } from "@turf/turf";

export type Coord = { latitude: number; longitude: number };

export type NavStep = {
  instructions: string;
  distance: number;
  path: Coord[];
  transportType?: string;
};

export type ManeuverType =
  | "turn-left"
  | "turn-right"
  | "straight"
  | "slight-left"
  | "slight-right"
  | "sharp-left"
  | "sharp-right"
  | "u-turn"
  | "depart"
  | "arrived";

export interface NavigationState {
  currentStepIndex: number;
  currentStep: NavStep;
  nextStep: NavStep | null;
  distanceToNextManeuver: number;
  distanceRemaining: number;
  isOffRoute: boolean;
  maneuverType: ManeuverType;
  offRouteDistance: number;
}

const OFF_ROUTE_THRESHOLD_M = 30;
const ADVANCE_PROGRESS_RATIO = 0.9;
const ADVANCE_NEXT_PROXIMITY_M = 20;

function stripHtml(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function inferManeuver(instructions: string): ManeuverType {
  const t = stripHtml(instructions).toLowerCase();
  if (/arriv|destination/.test(t)) return "arrived";
  if (/^(start|head|walk|proceed|depart|begin)\b/.test(t)) return "depart";
  if (/u-?turn/.test(t)) return "u-turn";
  if (/sharp\s*left/.test(t)) return "sharp-left";
  if (/sharp\s*right/.test(t)) return "sharp-right";
  if (/(slight|bear)\s*left/.test(t)) return "slight-left";
  if (/(slight|bear)\s*right/.test(t)) return "slight-right";
  if (/turn\s*left|left\s*onto|left\s*on/.test(t)) return "turn-left";
  if (/turn\s*right|right\s*onto|right\s*on/.test(t)) return "turn-right";
  return "straight";
}

function toLngLat(c: Coord): [number, number] {
  return [c.longitude, c.latitude];
}

function safeLine(coords: Coord[]) {
  if (!coords || coords.length < 2) return null;
  return lineString(coords.map(toLngLat));
}

export function getCurrentStep(
  userPosition: Coord,
  steps: NavStep[],
  currentStepIndex: number,
): NavigationState {
  const safeIndex = Math.min(Math.max(0, currentStepIndex), steps.length - 1);
  const userPt = point(toLngLat(userPosition));

  let idx = safeIndex;
  let current = steps[idx];
  let currentLine = safeLine(current.path);

  // Advance step if user has progressed past ~90% AND near start of next step.
  if (idx < steps.length - 1 && currentLine) {
    const snap = nearestPointOnLine(currentLine, userPt, { units: "meters" });
    const locationAlong = (snap.properties.location ?? 0) as number; // meters from start
    const totalLen = length(currentLine, { units: "meters" });
    const progress = totalLen > 0 ? locationAlong / totalLen : 0;

    const next = steps[idx + 1];
    if (next?.path?.length) {
      const nextStart = point(toLngLat(next.path[0]));
      const dToNextStart = distance(userPt, nextStart);
      if (progress >= ADVANCE_PROGRESS_RATIO && dToNextStart <= ADVANCE_NEXT_PROXIMITY_M) {
        idx += 1;
        current = steps[idx];
        currentLine = safeLine(current.path);
      }
    }
  }

  // distance to end of current step
  let distanceToNextManeuver = 0;
  if (currentLine) {
    const snap = nearestPointOnLine(currentLine, userPt, { units: "meters" });
    const locationAlong = (snap.properties.location ?? 0) as number;
    const totalLen = length(currentLine, { units: "meters" });
    distanceToNextManeuver = Math.max(0, totalLen - locationAlong);
  } else {
    distanceToNextManeuver = current.distance;
  }

  // total remaining = current step remaining + sum of future steps
  let distanceRemaining = distanceToNextManeuver;
  for (let i = idx + 1; i < steps.length; i++) {
    distanceRemaining += steps[i].distance;
  }

  // Off-route check: minimum distance from user to any step's path
  let minDist = Number.POSITIVE_INFINITY;
  for (const s of steps) {
    const line = safeLine(s.path);
    if (!line) continue;
    const snap = nearestPointOnLine(line, userPt, { units: "meters" });
    const d = (snap.properties.dist ?? Number.POSITIVE_INFINITY) as number;
    if (d < minDist) minDist = d;
  }
  const isOffRoute = minDist > OFF_ROUTE_THRESHOLD_M;

  const maneuverType = inferManeuver(current.instructions);
  const nextStep = idx < steps.length - 1 ? steps[idx + 1] : null;

  return {
    currentStepIndex: idx,
    currentStep: current,
    nextStep,
    distanceToNextManeuver,
    distanceRemaining,
    isOffRoute,
    maneuverType,
    offRouteDistance: minDist,
  };
}

// small great-circle distance helper for two turf points (meters)
function distance(a: ReturnType<typeof point>, b: ReturnType<typeof point>) {
  const [lon1, lat1] = a.geometry.coordinates;
  const [lon2, lat2] = b.geometry.coordinates;
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function formatManeuverDistance(m: number): string {
  if (m < 100) return `${Math.max(0, Math.round(m / 5) * 5)} m`;
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

// Human-friendly spoken distance — full words, not abbreviations.
export function formatDistanceSpoken(m: number): string {
  if (m < 100) {
    const rounded = Math.max(5, Math.round(m / 5) * 5);
    return `${rounded} metres`;
  }
  if (m < 1000) {
    const rounded = Math.round(m / 10) * 10;
    return `${rounded} metres`;
  }
  const km = m / 1000;
  return `${km.toFixed(1)} kilometres`;
}

function cleanInstruction(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Strip verbose instruction tails ("and continue for X metres", "for X km", etc).
export function instructionShort(step: NavStep): string {
  const text = cleanInstruction(step.instructions);
  // Cut at first " and continue", " and proceed", " then "
  const cut = text.search(
    /\s+(and\s+continue|and\s+proceed|then|for\s+\d)/i,
  );
  let short = cut > 0 ? text.slice(0, cut) : text;
  // Trim trailing punctuation
  short = short.replace(/[.,;:]+$/g, "").trim();
  return short;
}

export function instructionImminent(step: NavStep): string {
  const m = inferManeuver(step.instructions);
  switch (m) {
    case "turn-left":
      return "Turn left now";
    case "turn-right":
      return "Turn right now";
    case "slight-left":
      return "Bear left now";
    case "slight-right":
      return "Bear right now";
    case "sharp-left":
      return "Take the sharp left now";
    case "sharp-right":
      return "Take the sharp right now";
    case "u-turn":
      return "Make a U-turn now";
    case "arrived":
      return "You have arrived at your destination";
    case "depart":
    case "straight":
    default:
      return "Continue straight";
  }
}

export type AnnouncementState = "none" | "far" | "near" | "imminent" | "passed";

export function pickThresholds(speedMps: number | null | undefined) {
  const vehicle = speedMps != null && speedMps >= 2;
  return vehicle
    ? { far: 500, near: 100, imminent: 30 }
    : { far: 200, near: 30, imminent: 10 };
}

// Project a raw user position onto the nearest route polyline.
// Returns the snapped coord and the orthogonal distance (meters) to it.
export function snapToRoute(
  userPosition: Coord,
  steps: NavStep[],
): { snapped: Coord; distance: number } | null {
  if (!steps || steps.length === 0) return null;
  const userPt = point(toLngLat(userPosition));
  let best: { snapped: Coord; distance: number } | null = null;
  for (const s of steps) {
    const line = safeLine(s.path);
    if (!line) continue;
    const snap = nearestPointOnLine(line, userPt, { units: "meters" });
    const d = (snap.properties.dist ?? Number.POSITIVE_INFINITY) as number;
    if (!best || d < best.distance) {
      const [lng, lat] = snap.geometry.coordinates;
      best = { snapped: { latitude: lat, longitude: lng }, distance: d };
    }
  }
  return best;
}
