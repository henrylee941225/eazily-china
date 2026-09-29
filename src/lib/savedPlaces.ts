import { useEffect, useState } from "react";

const STORAGE_KEY = "eazilychina:savedPlaces";
const TOOLTIP_KEY = "eazilychina:hasSeenSavedTooltip";

export interface SavedPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  savedAt: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
const emit = () => listeners.forEach((l) => l());

function safeRead(): SavedPlace[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as SavedPlace[];
  } catch {
    return [];
  }
}

function safeWrite(places: SavedPlace[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // ignore (quota / private mode)
  }
}

export function getAll(): SavedPlace[] {
  return safeRead().sort((a, b) => b.savedAt - a.savedAt);
}

export function isSaved(id: string): boolean {
  return safeRead().some((p) => p.id === id);
}

export function save(place: SavedPlace): void {
  const all = safeRead();
  if (all.some((p) => p.id === place.id)) return;
  all.push(place);
  safeWrite(all);
  emit();
}

export function remove(id: string): void {
  const all = safeRead();
  const next = all.filter((p) => p.id !== id);
  if (next.length === all.length) return;
  safeWrite(next);
  emit();
}

export function generateId(place: {
  name: string;
  coordinate: { latitude: number; longitude: number };
}): string {
  const { name, coordinate } = place;
  return `${name}|${coordinate.latitude.toFixed(5)},${coordinate.longitude.toFixed(5)}`;
}

export function hasSeenSavedTooltip(): boolean {
  try {
    return localStorage.getItem(TOOLTIP_KEY) === "true";
  } catch {
    return true;
  }
}

export function markSavedTooltipSeen(): void {
  try {
    localStorage.setItem(TOOLTIP_KEY, "true");
  } catch {
    // ignore
  }
}

export function useSavedPlaces() {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>(() => getAll());

  useEffect(() => {
    const update = () => setSavedPlaces(getAll());
    listeners.add(update);
    // also react to cross-tab changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) update();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(update);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = (place: SavedPlace): { saved: boolean } => {
    if (isSaved(place.id)) {
      remove(place.id);
      return { saved: false };
    }
    save(place);
    return { saved: true };
  };

  return {
    savedPlaces,
    isSaved: (id: string) => savedPlaces.some((p) => p.id === id),
    toggle,
    remove,
  };
}