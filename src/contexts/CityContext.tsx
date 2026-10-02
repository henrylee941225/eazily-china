import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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

  const value = useMemo<CityContextValue>(
    () => ({ city: getCityById(cityId), cityId, setCityId, cities: ALPHABETICAL_CITIES }),
    [cityId],
  );
  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
};

export const useCity = () => {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error("useCity must be used inside <CityProvider>");
  return ctx;
};
