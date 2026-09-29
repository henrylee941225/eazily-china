import type { LucideIcon } from "lucide-react";
import { Palette, PartyPopper, Coffee, Map, UtensilsCrossed, Compass, Gem, PiggyBank } from "lucide-react";

export type InterestId =
  | "art"
  | "party"
  | "cafes"
  | "touring"
  | "foodie"
  | "hidden"
  | "luxury"
  | "budget";

export const INTERESTS: { id: InterestId; label: string; icon: LucideIcon; blurb: string }[] = [
  { id: "art", label: "Art", icon: Palette, blurb: "Galleries, museums, design" },
  { id: "party", label: "Party", icon: PartyPopper, blurb: "Bars, clubs, nightlife" },
  { id: "cafes", label: "Cafes", icon: Coffee, blurb: "Slow mornings, third-wave" },
  { id: "touring", label: "Touring", icon: Map, blurb: "Sights and landmarks" },
  { id: "foodie", label: "Foodie", icon: UtensilsCrossed, blurb: "Local cuisine, restaurants" },
  { id: "hidden", label: "Hidden gems", icon: Compass, blurb: "Off-the-beaten-path" },
  { id: "luxury", label: "Luxury", icon: Gem, blurb: "Premium experiences" },
  { id: "budget", label: "Budget", icon: PiggyBank, blurb: "Cheap & cheerful" },
];

export const isInterestId = (v: string): v is InterestId =>
  INTERESTS.some((i) => i.id === v);

// Heuristic keyword map used to infer which interests a pick matches
// when the pick doesn't declare them explicitly.
const KEYWORDS: Record<InterestId, string[]> = {
  art: ["gallery", "galleries", "museum", "art", "design", "creative", "pmq", "loft", "exhibition"],
  party: ["bar", "bars", "rooftop", "speakeasy", "club", "nightlife", "till 2am", "till 1am", "9pm", "10pm", "cocktail"],
  cafes: ["cafe", "café", "coffee", "tea", "teahouse", "tea bar", "milk tea", "brunch"],
  touring: ["temple", "garden", "wall", "palace", "tower", "must-see", "sunrise", "sunset", "walk", "stroll", "park", "hike", "skyline view", "pagoda", "mausoleum", "cruise", "monastery", "fort", "promenade"],
  foodie: ["dim sum", "noodle", "noodles", "duck", "fish", "hot pot", "hotpot", "xlb", "dumpling", "foodie", "restaurant", "cuisine", "tofu", "skewers", "seafood", "soup", "michelin"],
  hidden: ["hidden gem", "speakeasy", "alley", "hutong", "indie", "off-the-beaten", "quiet now", "calm", "less-crowded"],
  luxury: ["¥¥¥¥", "hk$$$", "premium", "michelin", "luxury", "rooftop", "skyline view"],
  budget: ["¥¥", "free", "cheap", "street eats", "street food", "¥10", "¥15", "¥30", "hk$5", "budget"],
};

export function inferInterests(text: string): InterestId[] {
  const lower = text.toLowerCase();
  const out: InterestId[] = [];
  for (const id of Object.keys(KEYWORDS) as InterestId[]) {
    if (KEYWORDS[id].some((kw) => lower.includes(kw))) out.push(id);
  }
  return out;
}

export function pickInterests(pick: { tag: string; blurb: string; meta: string; interests?: InterestId[] }): InterestId[] {
  if (pick.interests && pick.interests.length) return pick.interests;
  return inferInterests(`${pick.tag} ${pick.blurb} ${pick.meta}`);
}
