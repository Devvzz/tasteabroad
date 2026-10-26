// Typed client for the Qloo Insights API (hackathon environment).
// Server-side only: reads QLOO_API_KEY from process.env and must never be imported by client components.

const DEFAULT_BASE_URL = "https://hackathon.api.qloo.com";
const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

export const ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:place",
  "urn:entity:destination",
  "urn:entity:person",
  "urn:entity:podcast",
  "urn:entity:videogame",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface QlooEntity {
  id: string;
  name: string;
  type: string;
  popularity?: number;
  /** Taste affinity (0–1) when the entity came from an insights query. */
  affinity?: number;
  countryCode?: string;
  country?: string;
  location?: { lat: number; lon: number };
  imageUrl?: string;
  description?: string;
  /** English category name for places, e.g. "Coffee shop" or "Art museum". */
  category?: string;
  /** English neighbourhood name for places, e.g. "Downtown Seoul". */
  neighborhood?: string;
  /** Tag IDs attached to the entity (e.g. "urn:tag:genre:place:hotel"). */
  tagIds: string[];
}

export interface QlooTag {
  id: string;
  name: string;
  type: string;
  popularity?: number;
}

export interface InsightsQuery {
  filterType: EntityType;
  entityIds?: string[];
  tagIds?: string[];
  /** Restrict results to these entity IDs (used to score our own city list). */
  resultEntityIds?: string[];
  /** Only return results within this radius of a point (for places in one city). */
  location?: { lat: number; lon: number; radiusMeters: number };
  take?: number;
}

export type QlooErrorCode =
  | "missing_key"
  | "unauthorized"
  | "rate_limited"
  | "bad_request"
  | "timeout"
  | "network"
  | "upstream";

export class QlooError extends Error {
  constructor(
    public readonly code: QlooErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "QlooError";
  }
}

// ---------- cache ----------

const cache = new Map<string, { expires: number; value: unknown }>();

function cacheGet<T>(key: string): T | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

// ---------- HTTP ----------

type Params = Record<string, string | number | undefined>;

function buildUrl(path: string, params: Params): string {
  const base = process.env.QLOO_BASE_URL || DEFAULT_BASE_URL;
  const url = new URL(path, base);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  return url.toString();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function retryDelay(attempt: number, retryAfter: string | null): number {
  const seconds = retryAfter ? Number(retryAfter) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 5_000);
  return 400 * 2 ** attempt;
}

function errorForStatus(status: number, body: string): QlooError {
  if (status === 401 || status === 403) {
    return new QlooError("unauthorized", "Qloo rejected the API key (check QLOO_API_KEY).", status);
  }
  if (status === 429) return new QlooError("rate_limited", "Qloo rate limit reached. Try again shortly.", status);
  if (status >= 400 && status < 500) {
    return new QlooError("bad_request", `Qloo rejected the request: ${body.slice(0, 200)}`, status);
  }
  return new QlooError("upstream", `Qloo is unavailable right now (HTTP ${status}).`, status);
}

async function qlooGet<T>(path: string, params: Params): Promise<T | null> {
  const key = process.env.QLOO_API_KEY;
  if (!key) throw new QlooError("missing_key", "QLOO_API_KEY is not set on the server.");

  const url = buildUrl(path, params);
  const cached = cacheGet<T | null>(url);
  if (cached !== undefined) return cached;

  let lastError: QlooError | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "X-Api-Key": key, Accept: "application/json" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      // Qloo answers 404 when a search has no results; treat that as empty, not as a failure.
      if (res.status === 404) {
        cacheSet(url, null);
        return null;
      }
      if (res.ok) {
        const json = (await res.json()) as T;
        cacheSet(url, json);
        return json;
      }

      lastError = errorForStatus(res.status, await res.text());
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_RETRIES) throw lastError;
      await sleep(retryDelay(attempt, res.headers.get("retry-after")));
    } catch (err) {
      if (err instanceof QlooError) throw err;
      const isTimeout = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      lastError = isTimeout
        ? new QlooError("timeout", `Qloo did not answer within ${TIMEOUT_MS / 1000}s.`)
        : new QlooError("network", "Could not reach Qloo.");
      if (attempt === MAX_RETRIES) throw lastError;
      await sleep(retryDelay(attempt, null));
    }
  }
  throw lastError ?? new QlooError("upstream", "Unknown Qloo error.");
}

// ---------- response mapping ----------

interface RawEntity {
  entity_id: string;
  name: string;
  type?: string;
  types?: string[];
  popularity?: number;
  location?: { lat: number; lon: number };
  query?: { affinity?: number };
  tags?: { id?: string; tag_id?: string }[];
  properties?: {
    country?: string;
    geocode?: { country_code?: string };
    image?: { url?: string };
    short_description?: string;
    primary_genre?: { name?: string };
    neighborhood?: unknown;
  };
}

interface RawTag {
  id: string;
  name: string;
  type: string;
  popularity?: number;
}

function toEntity(raw: RawEntity): QlooEntity {
  const props = raw.properties ?? {};
  return {
    id: raw.entity_id,
    name: raw.name,
    type: raw.type ?? raw.types?.[0] ?? "unknown",
    popularity: raw.popularity,
    affinity: raw.query?.affinity,
    countryCode: props.geocode?.country_code,
    country: props.country,
    location: raw.location ? { lat: raw.location.lat, lon: raw.location.lon } : undefined,
    imageUrl: props.image?.url,
    description: props.short_description,
    category: props.primary_genre?.name,
    neighborhood: typeof props.neighborhood === "string" ? props.neighborhood : undefined,
    tagIds: (raw.tags ?? []).map((t) => t.id ?? t.tag_id).filter((id): id is string => Boolean(id)),
  };
}

// ---------- public API ----------

/** Resolve free text (e.g. "Dua Lipa") into Qloo entities. */
export async function searchEntities(query: string, types?: EntityType[], take = 5): Promise<QlooEntity[]> {
  const json = await qlooGet<{ results?: RawEntity[] }>("/search", {
    query: query.trim(),
    types: types?.join(","),
    take,
  });
  return (json?.results ?? []).map(toEntity);
}

/** Resolve a hobby or genre (e.g. "street food", "techno") into Qloo tags. */
export async function searchTags(query: string, take = 5): Promise<QlooTag[]> {
  const json = await qlooGet<{ results?: { tags?: RawTag[] } }>("/v2/tags", {
    "filter.query": query.trim(),
    take,
  });
  return (json?.results?.tags ?? []).map((t) => ({ id: t.id, name: t.name, type: t.type, popularity: t.popularity }));
}

/** Entities of `filterType` ranked by affinity to the given taste signals. */
export async function getInsights(q: InsightsQuery): Promise<QlooEntity[]> {
  if (!q.entityIds?.length && !q.tagIds?.length) {
    throw new QlooError("bad_request", "At least one entity or tag signal is required.");
  }
  const json = await qlooGet<{ results?: { entities?: RawEntity[] } }>("/v2/insights", {
    "filter.type": q.filterType,
    "signal.interests.entities": q.entityIds?.join(","),
    "signal.interests.tags": q.tagIds?.join(","),
    "filter.results.entities": q.resultEntityIds?.join(","),
    "filter.location": q.location ? `POINT(${q.location.lon} ${q.location.lat})` : undefined,
    "filter.location.radius": q.location?.radiusMeters,
    take: q.take ?? 20,
  });
  return (json?.results?.entities ?? []).map(toEntity);
}

export interface TasteSignals {
  entityIds: string[];
  tagIds: string[];
}

const INSIGHTS_MAX_TAKE = 50;

/** Score a fixed list of destinations (our curated cities) against the user's taste. */
export async function scoreDestinations(signals: TasteSignals, destinationIds: string[]): Promise<QlooEntity[]> {
  const batches: string[][] = [];
  for (let i = 0; i < destinationIds.length; i += INSIGHTS_MAX_TAKE) {
    batches.push(destinationIds.slice(i, i + INSIGHTS_MAX_TAKE));
  }
  const results = await Promise.all(
    batches.map((ids) =>
      getInsights({ filterType: "urn:entity:destination", ...signals, resultEntityIds: ids, take: ids.length }),
    ),
  );
  return results.flat().sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
}

/** Worldwide destinations with the strongest taste affinity. */
export function topDestinations(signals: TasteSignals, take = 30): Promise<QlooEntity[]> {
  return getInsights({ filterType: "urn:entity:destination", ...signals, take });
}

/**
 * Well-known entities that really carry a tag ("jazz" -> Miles Davis, Diana Krall...).
 * Most tags have no destination data of their own, but the entities behind them do.
 * Results without the tag are dropped: for tags Qloo cannot relate to a type it returns generic filler.
 */
export async function entitiesForTag(tagId: string, type: EntityType, take = 5, requireTag = true): Promise<QlooEntity[]> {
  const candidates = await getInsights({ filterType: type, tagIds: [tagId], take: 15 });
  // Artists only list a few tags each, so for music genres Qloo's own ranking is trusted as is.
  return (requireTag ? candidates.filter((e) => e.tagIds.includes(tagId)) : candidates).slice(0, take);
}

const CITY_RADIUS_METERS = 12_000;
// Very obscure places often only have local-script names; prefer ones people have heard of.
const MIN_PLACE_POPULARITY = 0.3;
// Location results include anything with an address (trade fairs, TV studios, apartment blocks),
// so only keep the kinds of places students actually go to.
const STUDENT_PLACE_TAGS = [
  "urn:tag:genre:place:restaurant", // includes bars, cafés and coffee shops
  "urn:tag:genre:place:tourist_attraction",
  "urn:tag:genre:place:historical_landmark",
  "urn:tag:genre:place:museum",
  "urn:tag:genre:place:park",
  "urn:tag:genre:place:stadium",
  "urn:tag:genre:place:brewery",
  "urn:tag:genre:place:festival",
  "urn:tag:genre:place:music_venue",
  "urn:tag:genre:place:nightlife",
  "urn:tag:genre:place:market",
  "urn:tag:genre:place:theater",
  "urn:tag:genre:place:beach",
];
// Hotels rank high for travellers, and trade-fair venues are tagged as attractions too.
const EXCLUDED_PLACE_TAGS = ["urn:tag:genre:place:hotel", "urn:tag:genre:place:event_venue", "urn:tag:genre:place:convention_center"];

function isStudentPlace(place: QlooEntity): boolean {
  const has = (prefixes: string[]) => place.tagIds.some((id) => prefixes.some((p) => id.startsWith(p)));
  return has(STUDENT_PLACE_TAGS) && !has(EXCLUDED_PLACE_TAGS);
}

/** Places inside one city that people with this taste rate highest. */
export async function placesNear(
  signals: TasteSignals,
  point: { lat: number; lon: number },
  take = 4,
): Promise<QlooEntity[]> {
  const places = await getInsights({
    filterType: "urn:entity:place",
    ...signals,
    location: { ...point, radiusMeters: CITY_RADIUS_METERS },
    take: 30,
  });
  const good = places.filter(isStudentPlace);
  const known = good.filter((p) => (p.popularity ?? 0) >= MIN_PLACE_POPULARITY);
  return (known.length >= take ? known : good).slice(0, take);
}

/** "People like you also liked…": other entities of a given type with high affinity. */
export async function similarEntities(signals: TasteSignals, type: EntityType, take = 5): Promise<QlooEntity[]> {
  const found = await getInsights({ filterType: type, ...signals, take });
  // Insights replies with the bare "urn:entity" type, so keep the one that was asked for (for the "Music"/"Film" label).
  return found.map((e) => ({ ...e, type }));
}
