import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CITIES, DEFAULT_CITY, getCityById, type CityData } from "@/data/cities";

type CityContextValue = {
  city: CityData;
  cityId: string;
  setCityId: (id: string) => void;
  cities: CityData[];
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

const ALPHABETICAL_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name));

export const CityProvider = ({ children }: { children: ReactNode }) => {
  const [cityId, setCityId] = useState<string>(DEFAULT_CITY.id);
  const userOverrideRef = useRef(false);

  const setCityIdManual = (id: string) => {
    userOverrideRef.current = true;
    setCityId(id);
  };

  // Auto-detect nearest supported city via browser geolocation on first load.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (userOverrideRef.current) return;
        const { latitude, longitude } = pos.coords;
        // Find nearest city by haversine distance
        let bestId = DEFAULT_CITY.id;
        let bestDist = Infinity;
        for (const c of CITIES) {
          const [lat, lng] = c.center;
          const dLat = ((lat - latitude) * Math.PI) / 180;
          const dLng = ((lng - longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((latitude * Math.PI) / 180) *
              Math.cos((lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const d = 2 * 6371 * Math.asin(Math.sqrt(a));
          if (d < bestDist) {
            bestDist = d;
            bestId = c.id;
          }
        }
        // Only auto-switch if reasonably close (< 500km)
        if (bestDist < 500) setCityId(bestId);
      },
      () => {
        // ignore — keep default city
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ city: getCityById(cityId), cityId, setCityId: setCityIdManual, cities: ALPHABETICAL_CITIES }),
    [cityId],
  );
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
};

export const useCity = () => {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used inside <CityProvider>");
  return ctx;
};