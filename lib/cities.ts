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
  tuition: { label: string; usdPerYear: Range; note?: string };
  costOfLiving?: { eurPerMonth: Range; usdPerMonth: Range };
  languages: string[];
  studentLife: string[];
  source: string;
  checked: string;
  accuracy: string;
}

export const cities = data.cities as City[];

/** The Qloo destination ID used to score a city (its own ID, or a nearby stand-in). */
export function scoringId(city: City): string | null {
  return city.qlooProxy?.id ?? city.qlooId;
}

export function getCity(idOrName: string): City | undefined {
  const key = idOrName.trim().toLowerCase();
  return cities.find((c) => c.id === key || c.name.toLowerCase() === key);
}
