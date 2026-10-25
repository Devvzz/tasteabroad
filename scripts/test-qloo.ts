// Smoke test for lib/qloo.ts. Run: npm run test:qloo
import {
  QlooError,
  scoreDestinations,
  searchEntities,
  searchTags,
  similarEntities,
  topDestinations,
} from "../lib/qloo";
import { cities, scoringId } from "../lib/cities";

async function main() {
  console.log("QLOO_API_KEY set:", Boolean(process.env.QLOO_API_KEY));

  const [artist] = await searchEntities("Dua Lipa", ["urn:entity:artist"], 1);
  const [show] = await searchEntities("Studio Ghibli", undefined, 1);
  const [tag] = await searchTags("street food", 1);
  console.log("search:", artist?.name, "/", show?.name, "/", tag?.id);

  const signals = { entityIds: [artist, show].filter(Boolean).map((e) => e.id), tagIds: tag ? [tag.id] : [] };

  const ids = cities.map(scoringId).filter((id): id is string => Boolean(id));
  const scored = await scoreDestinations(signals, ids);
  console.log(`scored ${scored.length}/${cities.length} dataset cities`);
  const scoredIds = new Set(scored.map((d) => d.id));
  const unscored = cities.filter((c) => !scoredIds.has(scoringId(c) ?? ""));
  if (unscored.length) console.log("NOT scored by Qloo:", unscored.map((c) => c.name).join(", "));
  console.log("top 5:", scored.slice(0, 5).map((d) => `${d.name} ${d.affinity?.toFixed(3)}`).join(", "));
  console.log("bottom 3:", scored.slice(-3).map((d) => `${d.name} ${d.affinity?.toFixed(3)}`).join(", "));

  const world = await topDestinations(signals, 5);
  console.log("worldwide top:", world.map((d) => `${d.name} (${d.countryCode})`).join(", "));

  const films = await similarEntities(signals, "urn:entity:movie", 3);
  console.log("also liked films:", films.map((f) => f.name).join(", "));

  const nothing = await searchEntities("zzqqxxnotarealthing123", undefined, 1);
  console.log("empty search returns:", nothing.length, "results");

  const t0 = Date.now();
  await searchEntities("Dua Lipa", ["urn:entity:artist"], 1);
  console.log(`cached repeat took ${Date.now() - t0}ms`);
}

main().catch((err) => {
  if (err instanceof QlooError) console.error(`QlooError [${err.code}]`, err.message);
  else console.error(err);
  process.exit(1);
});
