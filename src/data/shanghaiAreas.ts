// Curated Shanghai neighbourhoods for the Plan-my-day wizard.
// Each area lists the district / meta strings that map to it in the
// picks index (`city.picks`). Matching is case-insensitive substring.
// Venues whose district and meta location are BOTH absent are treated
// as eligible for every area (see recommend-stops edge function).
export type ShanghaiAreaId =
  | "bund"
  | "yu-garden"
  | "xintiandi"
  | "french-concession"
  | "jingan"
  | "west-bund";

export type ShanghaiArea = {
  id: ShanghaiAreaId;
  name: string;      // English display name
  nameZh: string;    // Chinese display characters
  descriptor: string; // One-line UI descriptor
  /** Natural-language suffix for plan titles, e.g. "on the Bund" or
   *  "in the French Concession". Combined as `Your day ${titleSuffix}`. */
  titleSuffix: string;
  // District / meta-location strings that map picks onto this area.
  // Order matters only for readability — matching is a substring OR.
  districts: string[];
};

export const SHANGHAI_AREAS: ShanghaiArea[] = [
  {
    id: "bund",
    name: "The Bund",
    nameZh: "外滩",
    descriptor: "Iconic riverfront and skyline views",
    titleSuffix: "on the Bund",
    districts: ["The Bund", "Bund", "Huangpu", "Hongkou"],
  },
  {
    id: "yu-garden",
    name: "Yu Garden & Old City",
    nameZh: "豫园",
    descriptor: "Classical gardens, temples and lantern-lit lanes",
    titleSuffix: "in Yu Garden",
    districts: ["Yu Garden", "Old City", "Huangpu"],
  },
  {
    id: "xintiandi",
    name: "Xintiandi",
    nameZh: "新天地",
    descriptor: "Shikumen lanes turned bars and design shops",
    titleSuffix: "in Xintiandi",
    districts: ["Xintiandi", "Huangpu"],
  },
  {
    id: "french-concession",
    name: "French Concession",
    nameZh: "法租界",
    descriptor: "Plane-tree streets, cafés and heritage villas",
    titleSuffix: "in the French Concession",
    districts: ["Former French Concession", "French Concession", "Xuhui"],
  },
  {
    id: "jingan",
    name: "Jing'an",
    nameZh: "静安",
    descriptor: "Temple, malls and modern dining",
    titleSuffix: "in Jing'an",
    districts: ["Jing'an", "Jingan"],
  },
  {
    id: "west-bund",
    name: "West Bund",
    nameZh: "西岸",
    descriptor: "Riverside art district south of the centre",
    titleSuffix: "on the West Bund",
    districts: ["West Bund", "Xuhui"],
  },
];

export const SHANGHAI_AREA_BY_ID: Record<ShanghaiAreaId, ShanghaiArea> =
  Object.fromEntries(SHANGHAI_AREAS.map((a) => [a.id, a])) as Record<
    ShanghaiAreaId,
    ShanghaiArea
  >;