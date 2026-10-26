// Per-taste scoring. Qloo ranks every city once for each taste; a city's match score is its average
// position across those rankings. Scoring all tastes at once lets one famous name drown out the rest
// and squeezes every city into a few points, so the tastes are kept apart.
import { cities, scoringId, type City } from "@/lib/cities";
import { entitiesForTag, scoreDestinations, type EntityType, type TasteSignals } from "@/lib/qloo";
import type { ResolvedSignal, TasteRank } from "./types";

// Most tags give every destination the same affinity (no city data). Anything flatter than this is ignored.
const FLAT_RANGE = 0.005;
// How many tags of the same input to try before giving up on it. Failed tries are cheap (one lookup each).
const MAX_TAG_TRIES = 3;

/**
 * Order for trying a taste's other tags: food first, then film and TV themes (their bridges are checked
 * against the tag), then music genres (not checked, so "football" should not land on a music genre first).
 */
function bridgeOrder(tagId: string): number {
  if (tagId.includes(":cuisine:")) return 0;
  if (tagId.includes(":keyword:") || tagId.includes(":media:")) return 1;
  if (tagId.includes(":music:")) return 2;
  return 3;
}
const BRIDGE_SIZE = 5;

export interface TasteScore {
  input: string;
  /** The Qloo entity or tag that produced the ranking. */
  signal: ResolvedSignal;
  /** Names of the entities a tag was scored through, if any. */
  via?: string[];
  /** Signals actually sent to Qloo for this taste (reused for the worldwide list). */
  used: TasteSignals;
  /** Qloo affinity per city scoring ID. */
  affinity: Map<string, number>;
}

export interface ScoredCity {
  city: City;
  score: number;
  breakdown: TasteRank[];
}

const scoringIds = () => cities.map(scoringId).filter((id): id is string => Boolean(id));

/** Affinity of every city for one set of signals, or null when Qloo returns the same value for all of them. */
async function affinityFor(signals: TasteSignals): Promise<Map<string, number> | null> {
  const scored = await scoreDestinations(signals, scoringIds());
  const values = scored.map((d) => d.affinity ?? 0);
  if (!values.length || Math.max(...values) - Math.min(...values) < FLAT_RANGE) return null;
  return new Map(scored.map((d) => [d.id, d.affinity ?? 0]));
}

/** Entity types a tag can be bridged through. Music genres go through artists, everything else through films and shows. */
function bridgeTypes(tagId: string): { type: EntityType; requireTag: boolean }[] {
  if (tagId.includes(":music:")) return [{ type: "urn:entity:artist", requireTag: false }];
  return [
    { type: "urn:entity:movie", requireTag: true },
    { type: "urn:entity:tv_show", requireTag: true },
  ];
}

async function scoreTag(tag: ResolvedSignal): Promise<Omit<TasteScore, "input"> | null> {
  // Food tags carry city data of their own ("street food" puts Seoul and Osaka on top).
  if (tag.id.includes(":cuisine:")) {
    const used = { entityIds: [], tagIds: [tag.id] };
    const affinity = await affinityFor(used);
    if (affinity) return { signal: tag, used, affinity };
  }
  for (const { type, requireTag } of bridgeTypes(tag.id)) {
    const entities = await entitiesForTag(tag.id, type, BRIDGE_SIZE, requireTag);
    if (entities.length < 2) continue;
    const used = { entityIds: entities.map((e) => e.id), tagIds: [] };
    const affinity = await affinityFor(used);
    if (affinity) return { signal: tag, via: entities.map((e) => e.name), used, affinity };
  }
  return null;
}

/**
 * Ranks all cities for one taste. Tries the chosen signal first, then other tags found for the same input
 * ("anime" as a music genre works when the TV keyword does not). Null when Qloo has no city data for it.
 */
export async function scoreTaste(chosen: ResolvedSignal, alternatives: ResolvedSignal[]): Promise<TasteScore | null> {
  if (chosen.kind === "entity") {
    const used = { entityIds: [chosen.id], tagIds: [] };
    const affinity = await affinityFor(used);
    return affinity ? { input: chosen.input, signal: chosen, used, affinity } : null;
  }
  const others = alternatives
    .filter((a) => a.kind === "tag" && a.id !== chosen.id)
    .sort((a, b) => bridgeOrder(a.id) - bridgeOrder(b.id));
  const tries = [chosen, ...others].slice(0, MAX_TAG_TRIES);
  for (const tag of tries) {
    const result = await scoreTag(tag);
    if (result) return { input: chosen.input, ...result };
  }
  return null;
}

/** Combines per-taste rankings: each city's score is its average percentile, 100 meaning first for every taste. */
export function rankCities(tastes: TasteScore[]): ScoredCity[] {
  const ids = scoringIds();
  const n = ids.length;
  const ranks = tastes.map((taste) => {
    const order = [...ids].sort((a, b) => (taste.affinity.get(b) ?? 0) - (taste.affinity.get(a) ?? 0));
    return new Map(order.map((id, i) => [id, i + 1]));
  });
  const meanAffinity = (id: string) => tastes.reduce((sum, t) => sum + (t.affinity.get(id) ?? 0), 0) / tastes.length;

  return cities
    .map((city) => {
      const id = scoringId(city) ?? "";
      const breakdown = tastes.map((taste, i) => ({ taste: taste.input, rank: ranks[i].get(id) ?? n, of: n }));
      const percentiles = breakdown.map((b) => (n > 1 ? (1 - (b.rank - 1) / (n - 1)) * 100 : 100));
      const score = Math.round(percentiles.reduce((a, b) => a + b, 0) / percentiles.length);
      return { city, score, breakdown, tiebreak: meanAffinity(id) };
    })
    .sort((a, b) => b.score - a.score || b.tiebreak - a.tiebreak)
    .map(({ city, score, breakdown }) => ({ city, score, breakdown }));
}
