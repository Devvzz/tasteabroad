import type { City, Range, Region } from "@/lib/cities";

export interface MatchFilters {
  maxTuitionUsd?: number;
  maxMonthlyUsd?: number;
  /** Languages the student could take classes in; a city matches if it teaches in any of them. */
  languages?: string[];
  regions?: Region[];
}

export interface MatchRequest {
  likes: string[];
  filters: MatchFilters;
}

export type StepKey = "plan" | "search" | "match" | "similar" | "cities" | "explain" | "fallback";
export type ErrorCode = "generic" | "rateLimited" | "noTaste" | "noCityData" | "qloo" | "badRequest";
export type NoteKey = "filtersRelaxed" | "llmFallback" | "unresolved" | "unscored";

export interface TraceEntry {
  tool: string;
  args: string;
  ms: number;
  ok: boolean;
  /** Plain facts about the call for the readable log: the tastes looked up, the city read, how many cities scored. */
  info?: { items?: string[]; count?: number };
}

export type AgentEvent =
  | { type: "step"; step: StepKey; status: "running" | "done" | "error"; detail?: string }
  | { type: "tool"; entry: TraceEntry }
  | { type: "result"; result: MatchResult }
  | { type: "error"; code: ErrorCode };

/** A user input that Qloo resolved to an entity or a tag. */
export interface ResolvedSignal {
  input: string;
  id: string;
  name: string;
  kind: "entity" | "tag";
  type: string;
  /** For tags scored through related entities: their names ("jazz" via Miles Davis, Diana Krall). */
  via?: string[];
  /** False when Qloo has no city data for this taste, so it did not affect the ranking. */
  scored?: boolean;
}

/** Where a city ranks among all cities for one of the user's tastes. */
export interface TasteRank {
  taste: string;
  rank: number;
  of: number;
}

export interface CityMatch {
  city: City;
  /** 0 to 100: the city's average position across the user's tastes, from Qloo's per-taste rankings. */
  score: number;
  breakdown: TasteRank[];
  why: string;
  studentLife: string;
}

/** A light summary of one city's place in the full ranking, for the map and the city checker. */
export interface RankingEntry {
  id: string;
  name: string;
  country: string;
  countryCode: string;
  region: Region;
  lat: number;
  lon: number;
  /** 1 is the best match among all cities. */
  rank: number;
  score: number;
  breakdown: TasteRank[];
  /** False when the city is outside the user's filters (budget, language, region). */
  fits: boolean;
  tuitionLabel: string;
  tuitionUsd: Range;
  monthlyUsd?: Range;
  /** Lowest tuition plus twelve months of the lowest living costs, when both are known. */
  yearlyUsd?: number;
  universities: { name: string; url: string }[];
}

export interface AlsoLikedItem {
  id: string;
  name: string;
  type: string;
  imageUrl?: string;
}

export interface MatchResult {
  likes: string[];
  filters: MatchFilters;
  resolved: ResolvedSignal[];
  unresolved: string[];
  /** Tastes Qloo recognised but has no city data for. */
  unscored: string[];
  cities: CityMatch[];
  /** Every scored city in match order, including the ones outside the filters. */
  ranking: RankingEntry[];
  /** The cheapest city to live and study in among the strong matches. */
  bestValueId?: string;
  alsoLiked: AlsoLikedItem[];
  worldwide: { name: string; countryCode?: string }[];
  notes: NoteKey[];
  trace: TraceEntry[];
  mode: "agent" | "fallback";
}
