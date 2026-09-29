import {
  Utensils,
  Bed,
  Camera,
  Train,
  ShoppingBag,
  MapPin,
  type LucideIcon,
} from "lucide-react";

export type CategoryVisual = { color: string; icon: LucideIcon };

export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  Food: { color: "#E63946", icon: Utensils },
  Hotels: { color: "#C9617A", icon: Bed },
  Attractions: { color: "#D4A33E", icon: Camera },
  Transport: { color: "#3A6B7D", icon: Train },
  Shopping: { color: "#7B5B8E", icon: ShoppingBag },
  generic: { color: "#1A1A1A", icon: MapPin },
};

export function getCategoryVisual(category: string | null | undefined): CategoryVisual {
  if (!category) return CATEGORY_VISUALS.generic;
  return CATEGORY_VISUALS[category] ?? CATEGORY_VISUALS.generic;
}