// Shared profile / preferences metadata used across Account, EditProfile
// and TravelPreferences. Values map to profiles.* columns.
//
// Keeping labels here (not inline in components) so the Account home chip
// list and the preferences editor never drift out of sync.

import type { LucideIcon } from "lucide-react";
import {
  Palette, Utensils, Sandwich, Landmark, Mountain, Wine,
  ShoppingBag, Camera, Store, Coffee, Building2,
} from "lucide-react";

// ---------- Interests -----------------------------------------------------
export type InterestSlug =
  | "art_museums" | "fine_dining" | "street_food" | "history" | "nature"
  | "nightlife" | "shopping" | "photography" | "markets" | "tea_coffee"
  | "architecture";

export const INTERESTS: { slug: InterestSlug; label: string; icon: LucideIcon }[] = [
  { slug: "art_museums", label: "Art & museums", icon: Palette },
  { slug: "fine_dining", label: "Fine dining",   icon: Utensils },
  { slug: "history",     label: "History",       icon: Landmark },
  { slug: "photography", label: "Photography",   icon: Camera },
  { slug: "tea_coffee",  label: "Tea & coffee",  icon: Coffee },
  { slug: "street_food", label: "Street food",   icon: Sandwich },
  { slug: "nightlife",   label: "Nightlife",     icon: Wine },
  { slug: "shopping",    label: "Shopping",      icon: ShoppingBag },
  { slug: "nature",      label: "Nature",        icon: Mountain },
  { slug: "markets",     label: "Markets",       icon: Store },
  { slug: "architecture",label: "Architecture",  icon: Building2 },
];

export const INTEREST_LABELS: Record<string, string> = INTERESTS.reduce(
  (acc, i) => ({ ...acc, [i.slug]: i.label }),
  {} as Record<string, string>,
);

// ---------- Dining budget -------------------------------------------------
// Column: profiles.dining_budget ("budget" | "mid" | "fine" | "luxury").
// The picker in the mockup surfaces three tiers using ¥ marks. We keep the
// column value intact and just skip "luxury" from the picker — a value of
// "luxury" already stored on the profile still displays correctly.
export type DiningBudget = "budget" | "mid" | "fine" | "luxury";

export const DINING_BUDGET_OPTIONS: { value: DiningBudget; label: string }[] = [
  { value: "budget", label: "¥"   },
  { value: "mid",    label: "¥¥"  },
  { value: "fine",   label: "¥¥¥" },
];

export const DINING_BUDGET_LABEL: Record<DiningBudget, string> = {
  budget: "¥",
  mid: "¥¥",
  fine: "¥¥¥",
  luxury: "¥¥¥¥",
};

// ---------- Spice level ---------------------------------------------------
// Column: profiles.spice_level (0–4).
export const SPICE_LEVELS: { value: number; label: string }[] = [
  { value: 0, label: "None"   },
  { value: 1, label: "Mild"   },
  { value: 2, label: "Medium" },
  { value: 3, label: "Hot"    },
  { value: 4, label: "Fiery"  },
];

export const SPICE_LEVEL_LABEL = (v: number | null | undefined): string =>
  SPICE_LEVELS.find((s) => s.value === v)?.label ?? "—";

// ---------- Dietary needs -------------------------------------------------
// Column: profiles.dietary_needs (string[]).
export const DIETARY_NEEDS: { slug: string; label: string }[] = [
  { slug: "no_chilli",   label: "No chilli"   },
  { slug: "vegetarian",  label: "Vegetarian"  },
  { slug: "vegan",       label: "Vegan"       },
  { slug: "halal",       label: "Halal"       },
  { slug: "kosher",      label: "Kosher"      },
  { slug: "gluten_free", label: "Gluten-free" },
  { slug: "nut_allergy", label: "Nut allergy" },
  { slug: "dairy_free",  label: "Dairy-free"  },
];

// ---------- Nationalities -------------------------------------------------
// Column: profiles.nationality (ISO 3166-1 alpha-2). Also drives the phone
// dial-code default in the profile editor.
export type Nationality = { code: string; name: string; dial: string };

export const NATIONALITIES: Nationality[] = [
  { code: "GB", name: "United Kingdom",       dial: "+44" },
  { code: "US", name: "United States",        dial: "+1"  },
  { code: "CA", name: "Canada",               dial: "+1"  },
  { code: "AU", name: "Australia",            dial: "+61" },
  { code: "NZ", name: "New Zealand",          dial: "+64" },
  { code: "IE", name: "Ireland",              dial: "+353"},
  { code: "FR", name: "France",               dial: "+33" },
  { code: "DE", name: "Germany",              dial: "+49" },
  { code: "IT", name: "Italy",                dial: "+39" },
  { code: "ES", name: "Spain",                dial: "+34" },
  { code: "NL", name: "Netherlands",          dial: "+31" },
  { code: "SE", name: "Sweden",               dial: "+46" },
  { code: "NO", name: "Norway",               dial: "+47" },
  { code: "DK", name: "Denmark",              dial: "+45" },
  { code: "FI", name: "Finland",              dial: "+358"},
  { code: "CH", name: "Switzerland",          dial: "+41" },
  { code: "AT", name: "Austria",              dial: "+43" },
  { code: "BE", name: "Belgium",              dial: "+32" },
  { code: "PT", name: "Portugal",             dial: "+351"},
  { code: "JP", name: "Japan",                dial: "+81" },
  { code: "SG", name: "Singapore",            dial: "+65" },
  { code: "HK", name: "Hong Kong",            dial: "+852"},
  { code: "AE", name: "United Arab Emirates", dial: "+971"},
];

export const dialForNationality = (code: string | null | undefined): string =>
  NATIONALITIES.find((n) => n.code === code)?.dial ?? "+44";
