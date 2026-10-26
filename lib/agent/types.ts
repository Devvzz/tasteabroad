import type { City, Region } from "@/lib/cities";

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
export type ErrorCode = "generic" | "rateLimited" | "noTaste" | "qloo" | "badRequest";
export type NoteKey = "filtersRelaxed" | "nearestFallback" | "llmFallback" | "unresolved";

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
}

export interface CityMatch {
  city: City;
  /** Qloo taste affinity as a percentage. */
  score: number;
  why: string;
  studentLife: string;
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
  cities: CityMatch[];
  alsoLiked: AlsoLikedItem[];
  worldwide: { name: string; countryCode?: string }[];
  notes: NoteKey[];
  trace: TraceEntry[];
  mode: "agent" | "fallback";
}
