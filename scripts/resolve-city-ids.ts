// Fills `qlooId` in data/cities.json by looking up each city as a Qloo destination.
// Run: npm run resolve:cities   (add --force to re-resolve cities that already have an ID)
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { searchEntities, type QlooEntity } from "../lib/qloo";
import type { City } from "../lib/cities";
import { distanceKm } from "../lib/geo";

const file = join(__dirname, "..", "data", "cities.json");
const force = process.argv.includes("--force");

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/-shi$/, "").trim();

const MAX_DISTANCE_KM = 60;

// Country names differ between sources ("England", "Czech Republic"), so match on distance instead.
function pickMatch(city: City, candidates: QlooEntity[]): QlooEntity | undefined {
  const nearby = candidates
    .filter((c) => c.location && distanceKm(c.location, city.coordinates) <= MAX_DISTANCE_KM)
    .sort((a, b) => Number(normalize(b.name) === normalize(city.name)) - Number(normalize(a.name) === normalize(city.name)));
  return nearby[0];
}

async function main() {
  const data = JSON.parse(readFileSync(file, "utf8")) as { cities: City[] };
  const unresolved: string[] = [];

  for (const city of data.cities) {
    if ((city.qlooId || city.qlooProxy) && !force) continue;
    const candidates = await searchEntities(city.name, ["urn:entity:destination"], 5);
    const match = pickMatch(city, candidates);
    if (match) {
      city.qlooId = match.id;
      console.log(`ok   ${city.name} -> ${match.name} (${match.country ?? match.countryCode ?? "?"})`);
    } else {
      unresolved.push(city.name);
      console.log(`miss ${city.name}: ${candidates.map((c) => `${c.name}/${c.country}`).join(", ") || "no results"}`);
    }
  }

  writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
  console.log(unresolved.length ? `\nUnresolved: ${unresolved.join(", ")}` : "\nAll cities resolved.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
