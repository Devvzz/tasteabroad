// The full ranking sent to the browser (for the map and the city checker) and the best value pick.
import { tuitionFor, type City } from "@/lib/cities";
import type { RankedCity } from "./tools";
import type { RankingEntry } from "./types";

// Best value only looks at strong matches, so a cheap city that fits nobody's taste never wins.
const BEST_VALUE_POOL = 15;

function yearlyUsd(city: City, euCitizen?: boolean): number | undefined {
  if (!city.costOfLiving) return undefined;
  return tuitionFor(city, euCitizen).min + 12 * city.costOfLiving.usdPerMonth.min;
}

/** Every ranked city in match order, marked by whether it is inside the user's filters. */
export function buildRanking(all: RankedCity[], fitting: RankedCity[], euCitizen?: boolean): RankingEntry[] {
  const fits = new Set(fitting.map((r) => r.city.id));
  return all.map(({ city, score, breakdown }, i) => ({
    id: city.id,
    name: city.name,
    country: city.country,
    countryCode: city.countryCode,
    region: city.region,
    lat: city.coordinates.lat,
    lon: city.coordinates.lon,
    rank: i + 1,
    score,
    breakdown,
    fits: fits.has(city.id),
    tuitionLabel: city.tuition.label,
    tuitionUsd: tuitionFor(city, euCitizen),
    monthlyUsd: city.costOfLiving?.usdPerMonth,
    yearlyUsd: yearlyUsd(city, euCitizen),
    universities: city.universities.slice(0, 3),
  }));
}

/** The cheapest year of study among the best matches that fit the filters. */
export function bestValue(fitting: RankedCity[], euCitizen?: boolean): string | undefined {
  let best: { id: string; cost: number } | undefined;
  for (const { city } of fitting.slice(0, BEST_VALUE_POOL)) {
    const cost = yearlyUsd(city, euCitizen);
    if (cost !== undefined && (!best || cost < best.cost)) best = { id: city.id, cost };
  }
  return best?.id;
}
