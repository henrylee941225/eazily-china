import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Drawer } from "@/components/ui/non-modal-drawer";
import {
  Navigation,
  Bookmark,
  BookmarkCheck,
  Share2,
  Copy,
  Phone,
  ArrowLeft,
  Footprints,
  Car,
  TrainFront,
  Check,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  ArrowUp,
  RotateCcw,
  RotateCw,
  MapPin,
  X,
  Volume2,
  VolumeX,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { AppleMapHandle, Place, RouteMode, RouteResult } from "@/components/AppleMap";
import { useAuth } from "@/contexts/AuthContext";
import { getCategoryVisual } from "@/lib/categoryVisuals";
import {
  getCurrentStep,
  formatManeuverDistance,
  snapToRoute,
  formatDistanceSpoken,
  instructionShort,
  instructionImminent,
  pickThresholds,
  type AnnouncementState,
  type NavigationState,
  type ManeuverType,
} from "@/lib/navigation";
import * as voice from "@/lib/voice";
import {
  useSavedPlaces,
  generateId,
  hasSeenSavedTooltip,
  markSavedTooltipSeen,
} from "@/lib/savedPlaces";

const SNAP_POINTS = [0.15, 0.5, 0.95];

function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const R = 6371000;
  const toRad = (n: number) => (n * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function formatDistance(m: number) {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function formatDuration(sec: number) {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return `${h}h ${rem}m`;
}

/**
 * Clean up a MapKit-formatted address for display.
 * - Splits on commas
 * - Removes any segment that is (or contains) the place name
 * - Removes near-duplicate consecutive segments
 * - Strips bare house numbers / fragments shorter than 2 chars
 */
function formatDisplayAddress(raw: string | undefined, placeName: string | undefined) {
  if (!raw) return "";
  const name = (placeName ?? "").trim().toLowerCase();
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const cleaned: string[] = [];
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (name && (lower === name || lower.includes(name))) continue;
    if (cleaned.length && cleaned[cleaned.length - 1].toLowerCase() === lower) continue;
    cleaned.push(part);
  }
  return cleaned.join(", ");
}

type Props = {
  place: Place | null;
  category: string | null;
  userCoord: { latitude: number; longitude: number } | null;
  mapHandle: AppleMapHandle | null;
  onClose: () => void;
  onFirstSave?: () => void;
  onNavigatingChange?: (isNavigating: boolean) => void;
};

export function PlaceSheet({ place, category, userCoord, mapHandle, onClose, onFirstSave, onNavigatingChange }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isSaved, toggle } = useSavedPlaces();
  const [snap, setSnap] = useState<number | string | null>(SNAP_POINTS[0]);
  const [view, setView] = useState<"details" | "directions">("details");
  const [mode, setMode] = useState<RouteMode>("walk");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const watchIdRef = useRef<number | null>(null);
  const lastHeadingRef = useRef<number>(0);
  const headingBufferRef = useRef<number[]>([]);
  const [navState, setNavState] = useState<NavigationState | null>(null);
  const stepIndexRef = useRef<number>(0);
  const lastDistanceLogRef = useRef<number>(0);
  const arrivedTimerRef = useRef<number | null>(null);
  const lastDisplayedDistanceRef = useRef<number | null>(null);
  const announcementStatesRef = useRef<AnnouncementState[]>([]);
  const hasAnnouncedArrivalRef = useRef<boolean>(false);
  const lastOffRouteAnnounceRef = useRef<number>(0);
  const lastUserPositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [muted, setMutedState] = useState<boolean>(() => voice.isMuted());
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [recalcFailed, setRecalcFailed] = useState(false);
  const offRouteTimestampRef = useRef<number | null>(null);
  const offRoutePositionRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const lastRecalculationRef = useRef<number>(0);
  const lastManualRetryRef = useRef<number>(0);
  const recalcInFlightRef = useRef<boolean>(false);
  const recalcTokenRef = useRef<number>(0);
  const isNavigatingRef = useRef<boolean>(false);
  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  const toggleMuted = () => {
    const next = !muted;
    setMutedState(next);
    voice.setMuted(next);
  };

  useEffect(() => {
    onNavigatingChange?.(isNavigating);
  }, [isNavigating, onNavigatingChange]);

  // Circular-mean smoothing across last 3 heading samples. Rejects samples
  // that differ from the current smoothed value by >90° (GPS outliers).
  const smoothHeading = (raw: number): number => {
    const buf = headingBufferRef.current;
    if (buf.length > 0) {
      const prevSmoothed = circularMean(buf);
      const delta = Math.abs(angularDiff(raw, prevSmoothed));
      if (delta > 90) {
        return prevSmoothed; // drop outlier
      }
    }
    buf.push(raw);
    if (buf.length > 3) buf.shift();
    return circularMean(buf);
  };

  // Snap distance to nearest 5m / 10m / 0.1km AND only update displayed
  // value when it crosses a rounding bucket — avoids per-frame re-renders.
  const quantizeDistance = (m: number): number => {
    if (m < 100) return Math.max(0, Math.round(m / 5) * 5);
    if (m < 1000) return Math.round(m / 10) * 10;
    return Math.round(m / 100) * 100;
  };

  const open = !!place;

  useEffect(() => {
    if (place) {
      setSnap(SNAP_POINTS[1]);
      setView("details");
      setRoute(null);
      setIsNavigating(false);
    }
  }, [place]);

  const coord = place?.coordinate as { latitude: number; longitude: number } | undefined;
  const distanceM = coord && userCoord ? haversineMeters(userCoord, coord) : null;
  // Rough walking pace ~80 m/min
  const walkMin = distanceM != null ? Math.max(1, Math.round(distanceM / 80)) : null;

  const fetchRoute = async (m: RouteMode) => {
    if (!place || !mapHandle) return;
    setLoadingRoute(true);
    setRoute(null);
    const result = await mapHandle.showRoute(place, m);
    setLoadingRoute(false);
    if (!result) {
      toast("Couldn't find a route", { duration: 3000 });
      return;
    }
    setRoute(result);
  };

  const handleDirections = () => {
    setView("directions");
    setIsNavigating(false);
    setStepsExpanded(false);
    // Force half snap so the route on the map underneath stays visible.
    requestAnimationFrame(() => setSnap(SNAP_POINTS[1]));
    setSnap(SNAP_POINTS[1]);
    fetchRoute(mode);
  };

  const handleModeChange = (m: RouteMode) => {
    setMode(m);
    setStepsExpanded(false);
    fetchRoute(m);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      // Don't tear down when the drawer auto-closes due to entering nav mode
      if (isNavigating) return;
      onClose();
      mapHandle?.deselectAll();
      mapHandle?.clearRoute();
      setIsNavigating(false);
    }
  };

  const handleStart = () => {
    if (!place || !mapHandle) return;
    if (!route || route.steps.length === 0) {
      toast("No route steps available");
      return;
    }
    // Unlock iOS Safari autoplay — must happen inside the user gesture.
    voice.prime();
    const destinationName = place.name ?? "Place";
    const destinationCoords = place.coordinate;
    console.log("[NAV] Started navigating to", destinationName, destinationCoords);
    setIsNavigating(true);
    stepIndexRef.current = 0;
    setNavState(null);
    setSnap(SNAP_POINTS[0]);
    headingBufferRef.current = [];
    lastDisplayedDistanceRef.current = null;
    announcementStatesRef.current = new Array(route.steps.length).fill("none");
    hasAnnouncedArrivalRef.current = false;
    lastOffRouteAnnounceRef.current = 0;
    offRouteTimestampRef.current = null;
    offRoutePositionRef.current = null;
    lastRecalculationRef.current = 0;
    lastManualRetryRef.current = 0;
    setIsRecalculating(false);
    setRecalcFailed(false);
    // Zoom to street-level for navigation
    mapHandle.setCameraDistance(500);
    // Take over the user dot so we can snap it to the route during nav
    mapHandle.setShowsUserLocation(false);
    // Swap the static single-line route + dest marker for the premium
    // per-step layered polylines + pulsing destination marker.
    if (destinationCoords) {
      mapHandle.setNavigationRoute(route.steps, destinationCoords as { latitude: number; longitude: number });
    }

    if (!navigator.geolocation) {
      console.error("[NAV] Geolocation unavailable for navigation");
      return;
    }
    // Clear any previous watcher just in case
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, heading, accuracy, speed } = pos.coords;
        console.log("[NAV] Position update", { lat: latitude, lng: longitude, heading, accuracy, speed });
        lastUserPositionRef.current = { latitude, longitude };
        const currentRoute = routeRef.current;

        // 1) Snap-to-route for the user dot (only when within 30m of route)
        let displayCoord = { latitude, longitude };
        if (currentRoute && currentRoute.steps.length > 0) {
          const snapped = snapToRoute({ latitude, longitude }, currentRoute.steps);
          if (snapped && snapped.distance <= 30) {
            displayCoord = snapped.snapped;
          }
        }
        mapHandle.setUserOverrideLocation(displayCoord);

        // 2) Camera follows the (snapped) position
        mapHandle.setCenterAnimated(displayCoord.latitude, displayCoord.longitude);
        console.log("[NAV] Camera moved to", displayCoord.latitude, displayCoord.longitude);
        mapHandle.setCameraDistance(500);

        // 3) Heading-up rotation with smoothing + outlier rejection
        if (heading != null && !Number.isNaN(heading)) {
          const smoothed = smoothHeading(heading);
          lastHeadingRef.current = smoothed;
          mapHandle.setRotation(smoothed);
          console.log("[NAV] Heading updated to", heading, "smoothed:", smoothed);
        } else {
          // Stationary — keep last known heading (don't snap back to north)
          mapHandle.setRotation(lastHeadingRef.current);
        }

        // 4) Update navigation state from steps
        if (currentRoute && currentRoute.steps.length > 0) {
          try {
            const prevIdx = stepIndexRef.current;
            const state = getCurrentStep(
              { latitude, longitude },
              currentRoute.steps,
              prevIdx,
            );
            if (state.currentStepIndex !== prevIdx) {
              console.log("[NAV] Step changed", {
                from: prevIdx,
                to: state.currentStepIndex,
                instruction: state.currentStep.instructions,
              });
              // Mark any skipped/previous steps as passed so we don't fire
              // late announcements for them.
              for (let i = prevIdx; i < state.currentStepIndex; i++) {
                announcementStatesRef.current[i] = "passed";
              }
              stepIndexRef.current = state.currentStepIndex;
              try {
                mapHandle.updateNavigationStepIndex(state.currentStepIndex);
              } catch (e) {
                console.warn("[NAV] step style update failed", e);
              }
            }
            const now = Date.now();
            if (now - lastDistanceLogRef.current > 5000) {
              lastDistanceLogRef.current = now;
              console.log("[NAV] Distance update", {
                distanceToNextManeuver: state.distanceToNextManeuver,
                distanceRemaining: state.distanceRemaining,
              });
            }
            // Off-route detection with confirmation window
            if (state.isOffRoute) {
              const nowMs = Date.now();
              if (offRouteTimestampRef.current == null) {
                offRouteTimestampRef.current = nowMs;
                offRoutePositionRef.current = { latitude, longitude };
                console.log(
                  "[NAV] Off-route timestamp set at distance",
                  Math.round(state.offRouteDistance),
                );
              } else {
                const elapsed = (nowMs - offRouteTimestampRef.current) / 1000;
                const startPos = offRoutePositionRef.current;
                const movedM = startPos
                  ? haversineMeters(startPos, { latitude, longitude })
                  : 0;
                const secondsSinceLastReroute =
                  lastRecalculationRef.current === 0
                    ? Infinity
                    : (nowMs - lastRecalculationRef.current) / 1000;
                if (
                  elapsed >= 10 &&
                  movedM >= 15 &&
                  !recalcInFlightRef.current &&
                  !isRecalculatingRef.current
                ) {
                  if (secondsSinceLastReroute < 30) {
                    console.log(
                      `[NAV] Recalculation skipped, too recent (${Math.round(secondsSinceLastReroute)}s)`,
                    );
                  } else {
                    console.log(
                      "[NAV] Off-route confirmed, triggering recalculation",
                    );
                    recalculateRef.current?.({ latitude, longitude }, "auto");
                  }
                }
              }
            } else {
              if (offRouteTimestampRef.current != null) {
                offRouteTimestampRef.current = null;
                offRoutePositionRef.current = null;
                setRecalcFailed(false);
              }
            }
            // Voice announcements for the active step
            {
              const stepIdx = state.currentStepIndex;
              const states = announcementStatesRef.current;
              const current = states[stepIdx] ?? "none";
              if (current !== "passed") {
                const { far, near, imminent } = pickThresholds(speed);
                const d = state.distanceToNextManeuver;
                if (d <= imminent && current !== "imminent") {
                  states[stepIdx] = "imminent";
                  voice.speak(instructionImminent(state.currentStep));
                } else if (
                  d <= near &&
                  current !== "near" &&
                  current !== "imminent"
                ) {
                  states[stepIdx] = "near";
                  voice.speak(
                    `In ${formatDistanceSpoken(d)}, ${instructionShort(state.currentStep)}`,
                  );
                } else if (d <= far && current === "none") {
                  states[stepIdx] = "far";
                  voice.speak(
                    `In ${formatDistanceSpoken(d)}, ${instructionShort(state.currentStep)}`,
                  );
                }
              }
            }
            // Auto-arrived when on last step and close to end
            const isLast = state.currentStepIndex === currentRoute.steps.length - 1;
            const arrived =
              state.maneuverType === "arrived" ||
              (isLast && state.distanceToNextManeuver < 15) ||
              state.distanceRemaining < 15;
            if (arrived && !hasAnnouncedArrivalRef.current) {
              hasAnnouncedArrivalRef.current = true;
              voice.speak("You have arrived at your destination");
            }
            const finalState: NavigationState = arrived
              ? { ...state, maneuverType: "arrived" }
              : state;
            // Only re-render when the displayed (quantized) distance changes,
            // or step changes, or off-route flag changes.
            const quant = quantizeDistance(finalState.distanceToNextManeuver);
            setNavState((prev) => {
              if (
                prev &&
                prev.currentStepIndex === finalState.currentStepIndex &&
                prev.maneuverType === finalState.maneuverType &&
                prev.isOffRoute === finalState.isOffRoute &&
                lastDisplayedDistanceRef.current === quant
              ) {
                return prev;
              }
              lastDisplayedDistanceRef.current = quant;
              return finalState;
            });
            if (arrived && arrivedTimerRef.current == null) {
              console.log("[NAV] Arrived at destination");
              arrivedTimerRef.current = window.setTimeout(() => {
                handleEndRef.current?.();
              }, 5000);
            }
          } catch (e) {
            console.warn("[NAV] step calc failed", e);
          }
        }
      },
      (err) => {
        console.error("[NAV] Position error:", err.code, err.message);
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
    watchIdRef.current = watchId;
    console.log("[NAV] watchPosition registered, watchId:", watchId);
  };

  const handleEnd = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (arrivedTimerRef.current != null) {
      window.clearTimeout(arrivedTimerRef.current);
      arrivedTimerRef.current = null;
    }
    // Invalidate any in-flight recalculation result.
    recalcTokenRef.current += 1;
    recalcInFlightRef.current = false;
    setIsRecalculating(false);
    setRecalcFailed(false);
    offRouteTimestampRef.current = null;
    offRoutePositionRef.current = null;
    lastRecalculationRef.current = 0;
    lastManualRetryRef.current = 0;
    lastUserPositionRef.current = null;
    voice.cancel();
    console.log("[NAV] Ended navigation, watchPosition cleared");
    lastHeadingRef.current = 0;
    headingBufferRef.current = [];
    lastDisplayedDistanceRef.current = null;
    mapHandle?.setRotation(0);
    mapHandle?.setCameraDistance(2000);
    mapHandle?.clearNavigationRoute();
    mapHandle?.clearRoute();
    mapHandle?.deselectAll();
    // Remove the snapped user dot and restore the built-in user location
    mapHandle?.setUserOverrideLocation(null);
    mapHandle?.setShowsUserLocation(true);
    setIsNavigating(false);
    setNavState(null);
    stepIndexRef.current = 0;
    setRoute(null);
    setView("details");
    setSnap(SNAP_POINTS[1]);
  };

  // Refs so the watchPosition closure always sees latest values without re-registering
  const routeRef = useRef<RouteResult | null>(null);
  useEffect(() => {
    routeRef.current = route;
  }, [route]);
  const handleEndRef = useRef<typeof handleEnd | null>(null);
  handleEndRef.current = handleEnd;

  const isRecalculatingRef = useRef<boolean>(false);
  useEffect(() => {
    isRecalculatingRef.current = isRecalculating;
  }, [isRecalculating]);
  const modeRef = useRef<RouteMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const placeRef = useRef<Place | null>(null);
  useEffect(() => {
    placeRef.current = place;
  }, [place]);

  const recalculateRoute = async (
    origin: { latitude: number; longitude: number },
    trigger: "auto" | "manual",
  ) => {
    if (!mapHandle) return;
    const currentPlace = placeRef.current;
    const dest = currentPlace?.coordinate as
      | { latitude: number; longitude: number }
      | undefined;
    if (!dest) return;
    if (recalcInFlightRef.current) return;
    recalcInFlightRef.current = true;
    const token = ++recalcTokenRef.current;
    setIsRecalculating(true);
    setRecalcFailed(false);
    if (!voice.isMuted()) voice.speak("Rerouting");
    console.log("[NAV] Recalculation started");
    try {
      const newRoute = await mapHandle.recalculateRoute(
        origin,
        dest,
        modeRef.current,
      );
      // If navigation ended mid-flight or a newer recalc started, discard.
      if (token !== recalcTokenRef.current || !isNavigatingRef.current) {
        console.log("[NAV] Recalculation result discarded (stale)");
        return;
      }
      if (!newRoute || newRoute.steps.length === 0) {
        console.warn("[NAV] Recalculation failed: empty route");
        setRecalcFailed(true);
        if (!voice.isMuted()) {
          voice.speak("Unable to find a new route. Please follow the map.");
        }
        return;
      }
      console.log(
        "[NAV] Recalculation succeeded with new route, steps:",
        newRoute.steps.length,
      );
      setRoute(newRoute);
      stepIndexRef.current = 0;
      announcementStatesRef.current = new Array(newRoute.steps.length).fill(
        "none",
      );
      lastDisplayedDistanceRef.current = null;
      offRouteTimestampRef.current = null;
      offRoutePositionRef.current = null;
      lastRecalculationRef.current = Date.now();
      try {
        mapHandle.clearNavigationRoute();
        mapHandle.setNavigationRoute(newRoute.steps, dest);
      } catch (e) {
        console.warn("[NAV] failed to swap navigation overlays", e);
      }
      // Delay the first-step announcement so it doesn't talk over "Rerouting".
      const firstStep = newRoute.steps[0];
      window.setTimeout(() => {
        if (
          !voice.isMuted() &&
          isNavigatingRef.current &&
          token === recalcTokenRef.current
        ) {
          voice.speak(instructionShort(firstStep));
          announcementStatesRef.current[0] = "far";
        }
      }, 1000);
    } catch (e) {
      console.warn("[NAV] Recalculation failed:", e);
      setRecalcFailed(true);
      if (!voice.isMuted()) {
        voice.speak("Unable to find a new route. Please follow the map.");
      }
    } finally {
      recalcInFlightRef.current = false;
      setIsRecalculating(false);
      if (trigger === "manual") lastManualRetryRef.current = Date.now();
    }
  };
  const recalculateRef = useRef<typeof recalculateRoute | null>(null);
  recalculateRef.current = recalculateRoute;

  const handleManualRetry = () => {
    const now = Date.now();
    if (now - lastManualRetryRef.current < 10000) {
      console.log("[NAV] Manual retry debounced");
      return;
    }
    lastManualRetryRef.current = now;
    console.log("[NAV] Manual retry requested");
    const last = lastUserPositionRef.current ?? offRoutePositionRef.current;
    if (!last) return;
    recalculateRoute(last, "manual");
  };

  // Auto-cleanup the watcher if the sheet unmounts mid-navigation
  useEffect(() => {
    return () => {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      if (arrivedTimerRef.current != null) {
        window.clearTimeout(arrivedTimerRef.current);
      }
      voice.cancel();
    };
  }, []);

  const phone = (place as { phone?: string; phoneNumber?: string } | null)?.phone ??
    (place as { phoneNumber?: string } | null)?.phoneNumber;

  const [addressExpanded, setAddressExpanded] = useState(false);
  useEffect(() => {
    setAddressExpanded(false);
  }, [place]);

  const displayAddress = useMemo(
    () => formatDisplayAddress(place?.formattedAddress, place?.name),
    [place?.formattedAddress, place?.name],
  );
  const isLongAddress = displayAddress.length > 90;

  const placeId = place?.coordinate
    ? generateId({
        name: place.name ?? "Place",
        coordinate: place.coordinate as { latitude: number; longitude: number },
      })
    : null;
  const saved = placeId ? isSaved(placeId) : false;

  const handleToggleSave = () => {
    if (!place || !placeId) return;
    if (!user) {
      navigate(`/auth?next=${encodeURIComponent("/map")}`);
      return;
    }
    const coord = place.coordinate as { latitude: number; longitude: number };
    const result = toggle({
      id: placeId,
      name: place.name ?? "Place",
      address: place.formattedAddress ?? "",
      latitude: coord.latitude,
      longitude: coord.longitude,
      category: category ?? "generic",
      savedAt: Date.now(),
    });
    if (result.saved) {
      toast.success("Saved to favourites", {
        duration: 2000,
        icon: <Check className="h-4 w-4" />,
      });
      if (!hasSeenSavedTooltip()) {
        markSavedTooltipSeen();
        window.setTimeout(() => onFirstSave?.(), 2100);
      }
    } else {
      toast("Removed from favourites", { duration: 2000 });
    }
  };

  const renderDetails = () => (
    <div className="px-4" style={{ paddingBottom: 96 }}>
      {/* Peek content — always visible */}
      <div>
        <h2 className="font-serif text-xl font-semibold text-ink">{place?.name ?? "Place"}</h2>
        <p className="text-sm text-ink-secondary mt-1">
          {[category, walkMin && `${walkMin} min walk`, distanceM && formatDistance(distanceM)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={handleDirections}
            className="flex-1 h-11 rounded-full text-sm font-semibold text-white bg-primary flex items-center justify-center gap-1.5"
          >
            <Navigation className="h-4 w-4 shrink-0" />
            <span>Directions</span>
          </button>
          <button
            type="button"
            onClick={handleToggleSave}
            className={`flex-1 h-11 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 ${
              saved
                ? "bg-primary-soft text-primary border border-transparent"
                : "bg-transparent text-ink border border-border-strong"
            }`}
          >
            {saved ? (
              <BookmarkCheck className="h-4 w-4 shrink-0" fill="currentColor" />
            ) : (
              <Bookmark className="h-4 w-4 shrink-0" />
            )}
            <span>{saved ? "Saved" : "Save"}</span>
          </button>
          <button
            type="button"
            onClick={() => toast("Share coming soon")}
            className="flex-1 h-11 rounded-full text-sm font-semibold border border-border-strong text-ink bg-transparent flex items-center justify-center gap-1.5"
          >
            <Share2 className="h-4 w-4 shrink-0" />
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* Half content */}
      <div className="mt-6">
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4">
          {[1, 2, 3].map((i) => {
            const meta = getCategoryVisual(category);
            const Icon = meta.icon;
            const iconSize = 64;
            return (
              <div
                key={i}
                className="relative flex-shrink-0 overflow-hidden rounded-xl"
                style={{ width: 280, height: 180, background: meta.color }}
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <Icon
                    style={{ width: iconSize, height: iconSize, color: "rgba(255,255,255,0.5)" }}
                  />
                </div>
                <span
                  className="absolute bottom-3 left-3 text-[12px]"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Photos coming soon
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-ink-tertiary">Address</p>
            <p
              className={`text-sm text-ink mt-1 ${
                isLongAddress && !addressExpanded ? "line-clamp-3" : ""
              }`}
            >
              {displayAddress || "Address unavailable"}
            </p>
            {isLongAddress && (
              <button
                type="button"
                onClick={() => setAddressExpanded((v) => !v)}
                className="mt-1 text-xs font-medium text-primary"
              >
                {addressExpanded ? "Show less" : "Show full address"}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              if (place?.formattedAddress) {
                navigator.clipboard.writeText(place.formattedAddress);
                toast("Address copied");
              }
            }}
            className="shrink-0 h-9 w-9 rounded-full border border-border-strong flex items-center justify-center"
            aria-label="Copy address"
          >
            <Copy className="h-4 w-4 text-ink-secondary" />
          </button>
        </div>

        {phone && (
          <a
            href={`tel:${phone}`}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-primary"
          >
            <Phone className="h-4 w-4" /> {phone}
          </a>
        )}
      </div>

      <div className="mt-6 p-5 rounded-2xl bg-ink text-white">
        <p
          className="text-white/70 font-sans uppercase tracking-[0.12em]"
          style={{ fontSize: 12 }}
        >
          Show this to your driver
        </p>
        <p
          className="font-serif text-white mt-3 leading-snug"
          style={{ fontSize: 22 }}
        >
          {place?.name ? `${place.name} · ` : ""}
          {place?.formattedAddress ?? "Address unavailable"}
        </p>
      </div>

      <button
        type="button"
        onClick={() => {
          const destination = place?.name || place?.formattedAddress || "";
          if (!user) {
            toast("Please sign in to arrange a transfer");
            navigate(`/auth?redirect=${encodeURIComponent("/transfers")}`, {
              state: { destination },
            });
            return;
          }
          navigate("/transfers", { state: { destination } });
        }}
        data-vaul-no-drag
        className="mt-6 w-full h-12 rounded-full text-sm font-semibold text-white bg-primary"
      >
        Get a ride here
      </button>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink">Hours</h3>
        <p className="text-sm text-ink-secondary mt-1">Hours not available</p>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-ink">About</h3>
        <p className="text-sm text-ink-secondary mt-1">
          More details about this place will appear here.
        </p>
      </div>
    </div>
  );

  const modes: Array<{ id: RouteMode; label: string; icon: typeof Footprints }> = [
    { id: "walk", label: "Walk", icon: Footprints },
    { id: "drive", label: "Drive", icon: Car },
    { id: "transit", label: "Transit", icon: TrainFront },
  ];

  const renderDirections = () => {
    const visibleSteps = route?.steps.filter((s) => s.distance > 0) ?? [];
    const showStepsRow = visibleSteps.length > 2;
    const modeSubtitle =
      mode === "walk"
        ? "mostly walking"
        : mode === "drive"
          ? "mostly driving"
          : "transit";

    return (
      <div className="flex flex-col h-full min-h-0 bg-surface-elevated">
        {/* HEADER */}
        <div className="px-4 pt-4 pb-2 flex items-start gap-3">
          <button
            type="button"
            onClick={() => {
              setView("details");
              mapHandle?.clearRoute();
            }}
            className="h-9 w-9 shrink-0 rounded-full border border-border-strong flex items-center justify-center"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4 text-ink" />
          </button>
          <div className="min-w-0">
            <p className="text-sm text-ink-secondary">Directions to</p>
            <h2 className="font-serif text-ink text-xl font-bold truncate">
              {place?.name ?? "Destination"}
            </h2>
          </div>
        </div>

        {/* MODE TABS */}
        <div className="px-4 py-2">
          <div className="flex gap-2 p-1 bg-background rounded-full">
            {modes.map((m) => {
              const Icon = m.icon;
              const selected = mode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeChange(m.id)}
                  className={`flex-1 h-9 rounded-full text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${
                    selected
                      ? "bg-surface-elevated text-ink shadow-sm"
                      : "bg-transparent text-ink-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ETA + DISTANCE */}
        <div className="px-4 pt-2 pb-3">
          {loadingRoute ? (
            <p className="text-sm text-ink-secondary">Calculating route…</p>
          ) : route ? (
            <>
              <p className="font-serif text-ink text-4xl font-bold leading-none">
                {formatDuration(route.etaSec)}
              </p>
              <p className="text-ink-secondary text-base mt-1">
                {formatDistance(route.distance)}
              </p>
            </>
          ) : (
            <p className="text-sm text-ink-secondary">No route available</p>
          )}
        </div>

        {/* START BUTTON */}
        <div className="px-4 pb-3">
          <button
            type="button"
            onClick={handleStart}
            data-vaul-no-drag
            disabled={!route || loadingRoute}
            className="w-full py-4 rounded-full bg-primary text-white font-semibold text-lg disabled:opacity-50"
          >
            Start
          </button>
        </div>

        {/* STEPS PREVIEW (COLLAPSIBLE) */}
        {showStepsRow && (
          <div className="border-t border-border flex flex-col min-h-0">
            <button
              type="button"
              onClick={() => setStepsExpanded((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between text-left shrink-0"
              aria-expanded={stepsExpanded}
            >
              <span className="text-ink-secondary text-sm">
                {visibleSteps.length} steps · {modeSubtitle}
              </span>
              <ChevronDown
                size={20}
                className={`text-ink-secondary transition-transform duration-200 ${
                  stepsExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {stepsExpanded && (
              <div
                className="sheet-scroll flex-1 overflow-y-auto px-4 pb-4 border-t border-border min-h-0"
                style={{
                  paddingBottom: "calc(16px + 64px + env(safe-area-inset-bottom))",
                }}
              >
                {visibleSteps.map((step, i) => (
                  <div key={i} className="py-3 border-b border-border last:border-b-0">
                    <p
                      className="text-sm text-ink"
                      dangerouslySetInnerHTML={{ __html: step.instructions }}
                    />
                    <p className="text-xs text-ink-secondary mt-1">
                      {formatDistance(step.distance)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const maneuverIcon = (m: ManeuverType) => {
    switch (m) {
      case "turn-left":
        return CornerUpLeft;
      case "turn-right":
        return CornerUpRight;
      case "slight-left":
        return ArrowUpLeft;
      case "slight-right":
        return ArrowUpRight;
      case "sharp-left":
        return RotateCcw;
      case "sharp-right":
        return RotateCw;
      case "u-turn":
        return RotateCcw;
      case "arrived":
        return MapPin;
      case "depart":
        return Navigation;
      case "straight":
      default:
        return ArrowUp;
    }
  };

  const renderManeuverBanner = () => {
    const arrived = navState?.maneuverType === "arrived";
    const Icon = arrived ? Check : maneuverIcon(navState?.maneuverType ?? "straight");
    const distanceLabel = navState
      ? formatManeuverDistance(quantizeDistance(navState.distanceToNextManeuver))
      : "—";
    const instruction = arrived
      ? "You've arrived"
      : navState
        ? stripTags(navState.currentStep.instructions)
        : `Navigating to ${place?.name ?? "destination"}`;
    const offRouteConfirmed = offRouteTimestampRef.current != null;

    return (
      <div
        className="fixed inset-x-0 z-50 pointer-events-none"
        style={{ top: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="mx-4 mt-3 pointer-events-auto animate-fade-in">
          <div
            className={`flex items-center gap-3 rounded-2xl shadow-2xl px-4 py-3 ${
              arrived ? "bg-emerald-500/10" : "bg-surface-elevated"
            }`}
          >
            <div className="shrink-0 w-16 h-16 flex items-center justify-center">
              {isRecalculating ? (
                <Loader2
                  className="text-primary animate-spin"
                  style={{ width: 48, height: 48 }}
                  strokeWidth={2.25}
                />
              ) : (
                <Icon
                  className={arrived ? "text-emerald-600" : "text-primary"}
                  style={{ width: 56, height: 56 }}
                  strokeWidth={2.25}
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              {isRecalculating ? (
                <>
                  <p
                    className="font-serif font-semibold text-ink leading-none"
                    style={{ fontSize: 22 }}
                  >
                    Rerouting…
                  </p>
                  <p className="mt-1 text-sm text-ink-secondary">
                    Finding a new route
                  </p>
                </>
              ) : (
                <>
                  {!arrived && (
                    <p
                      className="font-serif font-semibold text-ink leading-none"
                      style={{ fontSize: 28 }}
                    >
                      {distanceLabel}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-sm line-clamp-2 ${
                      arrived ? "font-serif text-ink text-lg" : "text-ink-secondary"
                    }`}
                  >
                    {instruction}
                  </p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={toggleMuted}
              aria-label={muted ? "Unmute voice" : "Mute voice"}
              aria-pressed={muted}
              className="shrink-0 h-8 w-8 rounded-full bg-primary-soft flex items-center justify-center"
            >
              {muted ? (
                <VolumeX className="h-4 w-4 text-primary" />
              ) : (
                <Volume2 className="h-4 w-4 text-primary" />
              )}
            </button>
            <button
              type="button"
              onClick={handleEnd}
              aria-label={arrived ? "Done" : "End navigation"}
              className="shrink-0 h-9 w-9 rounded-full bg-primary-soft flex items-center justify-center"
            >
              <X className="h-4 w-4 text-primary" />
            </button>
          </div>
          {offRouteConfirmed && !arrived && !isRecalculating && (
            <div className="mt-2 flex justify-center">
              {recalcFailed ? (
                <button
                  type="button"
                  onClick={handleManualRetry}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-amber-200 text-ink active:bg-amber-300"
                >
                  Off route · tap to retry
                </button>
              ) : (
                <span className="px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-ink-secondary">
                  You're off route
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {isNavigating && renderManeuverBanner()}
      <Drawer.Root
      open={open && !isNavigating}
      onOpenChange={handleOpenChange}
      modal={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <Drawer.Portal>
        <Drawer.Content
          className="fixed inset-x-0 bottom-0 z-40 flex flex-col rounded-t-2xl bg-surface-elevated shadow-2xl outline-none"
          style={{ height: "95vh" }}
        >
          <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-gray-300" />
          <Drawer.Title className="sr-only">{place?.name ?? "Place details"}</Drawer.Title>
          <Drawer.Description className="sr-only">
            {place?.formattedAddress ?? ""}
          </Drawer.Description>
          <div className="mt-3 flex-1 overflow-hidden flex flex-col min-h-0">
            {view === "details" ? (
              <div className="sheet-scroll flex-1 overflow-y-auto">{renderDetails()}</div>
            ) : (
              renderDirections()
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
    </>
  );
}

function stripTags(s: string) {
  return s.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// Smallest signed angular difference between two compass bearings, in degrees.
function angularDiff(a: number, b: number): number {
  let d = ((a - b + 540) % 360) - 180;
  if (d <= -180) d += 360;
  return d;
}

// Circular mean of compass bearings (degrees) — handles wrap-around at 0/360.
function circularMean(degrees: number[]): number {
  if (degrees.length === 0) return 0;
  let x = 0;
  let y = 0;
  for (const d of degrees) {
    const r = (d * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  const mean = (Math.atan2(y / degrees.length, x / degrees.length) * 180) / Math.PI;
  return (mean + 360) % 360;
}