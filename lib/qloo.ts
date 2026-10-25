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
  properties?: {
    country?: string;
    geocode?: { country_code?: string };
    image?: { url?: string };
    short_description?: string;
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

/** "People like you also liked…": other entities of a given type with high affinity. */
export function similarEntities(signals: TasteSignals, type: EntityType, take = 5): Promise<QlooEntity[]> {
  return getInsights({ filterType: type, ...signals, take });
}
