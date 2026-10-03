import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CITIES, DEFAULT_CITY, getCityById, type CityData } from "@/data/cities";
import { getCurrentLocation } from "@/integrations/capacitor/geolocation";

type CityContextValue = {
  city: CityData;
  cityId: string;
  setCityId: (id: string) => void;
  cities: CityData[];
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

const ALPHABETICAL_CITIES = [...CITIES].sort((a, b) => a.name.localeCompare(b.name));
const toRadians = (degrees: number) => degrees * Math.PI / 180;

const nearestCityId = (latitude: number, longitude: number): string => {
  const latitudeRad = toRadians(latitude);
  let nearest = CITIES[0];
  let shortestDistance = Infinity;

  for (const city of CITIES) {
    const latitudeDelta = toRadians(city.center[0] - latitude);
    const longitudeDelta = toRadians(city.center[1] - longitude);
    const distance = Math.sin(latitudeDelta / 2) ** 2
      + Math.cos(latitudeRad) * Math.cos(toRadians(city.center[0])) * Math.sin(longitudeDelta / 2) ** 2;
    if (distance < shortestDistance) {
      nearest = city;
      shortestDistance = distance;
    }
  }

  return nearest.id;
};

export const CityProvider = ({ children }: { children: ReactNode }) => {
  const [cityId, updateCityId] = useState<string>(DEFAULT_CITY.id);
  const manuallySelected = useRef(false);
  const setCityId = useCallback((id: string) => {
    manuallySelected.current = true;
    updateCityId(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void getCurrentLocation({ enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 })
      .then(({ coords }) => {
        const { latitude, longitude } = coords;
        if (!cancelled && !manuallySelected.current && Number.isFinite(latitude) && Number.isFinite(longitude)) {
          updateCityId(nearestCityId(latitude, longitude));
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const value = useMemo<CityContextValue>(
    () => ({ city: getCityById(cityId), cityId, setCityId, cities: ALPHABETICAL_CITIES }),
    [cityId, setCityId],
  );
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
};

export const useCity = () => {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used inside <CityProvider>");
  return ctx;
};
