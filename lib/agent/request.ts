import { isLang } from "@/lib/i18n";
import type { Region } from "@/lib/cities";
import type { MatchFilters, MatchRequest } from "./types";

const REGIONS: Region[] = ["Europe", "North America", "Asia", "Oceania", "Latin America", "Middle East", "Africa"];
const MAX_LIKES = 8;
const MAX_LIKE_LENGTH = 60;

function positiveNumber(value: unknown): number | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Validate untrusted input (request body or share-link params). Returns null when unusable. */
export function parseMatchRequest(input: unknown): MatchRequest | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;

  const likes = (Array.isArray(body.likes) ? body.likes : [])
    .filter((l): l is string => typeof l === "string")
    .map((l) => l.trim().slice(0, MAX_LIKE_LENGTH))
    .filter(Boolean);
  const uniqueLikes = [...new Map(likes.map((l) => [l.toLowerCase(), l])).values()].slice(0, MAX_LIKES);
  if (!uniqueLikes.length) return null;

  const raw = (body.filters && typeof body.filters === "object" ? body.filters : {}) as Record<string, unknown>;
  const filters: MatchFilters = {
    maxTuitionUsd: positiveNumber(raw.maxTuitionUsd),
    maxMonthlyUsd: positiveNumber(raw.maxMonthlyUsd),
    language: typeof raw.language === "string" && raw.language.trim() ? raw.language.trim().slice(0, 30) : undefined,
    regions: Array.isArray(raw.regions) ? raw.regions.filter((r): r is Region => REGIONS.includes(r as Region)) : undefined,
  };

  return { likes: uniqueLikes, filters, lang: isLang(body.lang) ? body.lang : "en" };
}

/** Stable key for caching identical requests. */
export function requestKey(req: MatchRequest): string {
  const f = req.filters;
  return JSON.stringify([
    req.likes.map((l) => l.toLowerCase()).sort(),
    f.maxTuitionUsd ?? null,
    f.maxMonthlyUsd ?? null,
    f.language?.toLowerCase() ?? null,
    [...(f.regions ?? [])].sort(),
    req.lang,
  ]);
}
