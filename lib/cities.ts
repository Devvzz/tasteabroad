import data from "@/data/cities.json";

export type Region = "Europe" | "North America" | "Asia" | "Oceania" | "Latin America" | "Middle East" | "Africa";

export interface Range {
  min: number;
  max: number;
}

export interface City {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: Region;
  coordinates: { lat: number; lon: number };
  /** Qloo destination entity ID, filled by scripts/resolve-city-ids.ts. */
  qlooId: string | null;
  /** Nearby destination scored instead, when Qloo insights has no score for the city itself. */
  qlooProxy?: { id: string; name: string; reason: string };
  universities: { name: string; url: string }[];
  tuition: {
    label: string;
    /** Full range, from the cheapest (often EU/EEA) fee to the highest. */
    usdPerYear: Range;
    /** What students without an EU/EEA passport pay, where that differs (Stockholm: free for EU, $9k+ for others). */
    nonEuUsdPerYear?: Range;
    note?: string;
  };
  costOfLiving?: { eurPerMonth: Range; usdPerMonth: Range };
  languages: string[];
  studentLife: string[];
  source: string;
  checked: string;
  accuracy: string;
}

export const cities = data.cities as City[];

/** The tuition range that applies to this student. Without an EU/EEA passport the higher fee counts. */
export function tuitionFor(city: City, euCitizen = false): Range {
  return (!euCitizen && city.tuition.nonEuUsdPerYear) || city.tuition.usdPerYear;
}

/** The Qloo destination ID used to score a city (its own ID, or a nearby stand-in). */
export function scoringId(city: City): string | null {
  return city.qlooProxy?.id ?? city.qlooId;
}

export function getCity(idOrName: string): City | undefined {
  const key = idOrName.trim().toLowerCase();
  return cities.find((c) => c.id === key || c.name.toLowerCase() === key);
}
