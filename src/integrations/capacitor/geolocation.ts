import { Geolocation, type Position, type PositionOptions } from "@capacitor/geolocation";
import { isCapacitorApp } from "@/integrations/capacitor";

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 60000,
  enableLocationFallback: true,
};

let permissionRequest: Promise<void> | null = null;

function ensurePermission(): Promise<void> {
  if (!isCapacitorApp()) return Promise.resolve();
  if (permissionRequest) return permissionRequest;
  permissionRequest = (async () => {
    let permission = await Geolocation.checkPermissions();
    if (permission.location === "granted" || permission.coarseLocation === "granted") return;
    permission = await Geolocation.requestPermissions({ permissions: ["location"] });
    if (permission.location !== "granted" && permission.coarseLocation !== "granted") {
      throw Object.assign(new Error("Location permission denied"), { code: "OS-PLUG-GLOC-0003" });
    }
  })().finally(() => { permissionRequest = null; });
  return permissionRequest;
}

export async function getCurrentLocation(options: PositionOptions = {}): Promise<Position> {
  await ensurePermission();
  return Geolocation.getCurrentPosition({ ...DEFAULT_OPTIONS, ...options });
}

/** Returns a synchronous stop function, including while native registration is pending. */
export function watchLocation(
  onPosition: (position: Position) => void,
  onError: (error: unknown) => void,
  options: PositionOptions = {},
): () => void {
  let active = true;
  let watchId: string | null = null;
  const clear = (id: string) => {
    void Geolocation.clearWatch({ id }).catch((error) => console.warn("Location cleanup failed", error));
  };

  void (async () => {
    await ensurePermission();
    if (!active) return;
    const id = await Geolocation.watchPosition(
      { ...DEFAULT_OPTIONS, maximumAge: 0, interval: 2000, minimumUpdateInterval: 1000, ...options },
      (position, error: unknown) => {
        if (!active) return;
        if (error) onError(error);
        else if (position) onPosition(position);
      },
    );
    if (active) watchId = id;
    else clear(id);
  })().catch((error: unknown) => {
    if (active) onError(error);
  });

  return () => {
    active = false;
    if (watchId !== null) {
      clear(watchId);
      watchId = null;
    }
  };
}

export const isLocationPermissionDenied = (error: unknown): boolean => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === 1 || code === "OS-PLUG-GLOC-0003" || code === "OS-PLUG-GLOC-0008";
};
