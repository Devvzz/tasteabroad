// Encodes a search (likes and filters) in URL params so results can be shared.
import type { Region } from "@/lib/cities";
import type { MatchFilters } from "@/lib/agent/types";

export interface SearchState {
  likes: string[];
  filters: MatchFilters;
}

export function toSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  state.likes.forEach((l) => params.append("l", l));
  if (state.filters.maxTuitionUsd) params.set("tuition", String(state.filters.maxTuitionUsd));
  if (state.filters.maxMonthlyUsd) params.set("budget", String(state.filters.maxMonthlyUsd));
  state.filters.languages?.forEach((l) => params.append("study", l));
  state.filters.regions?.forEach((r) => params.append("region", r));
  return params;
}

export function fromSearchParams(params: URLSearchParams): SearchState {
  const num = (key: string) => {
    const n = Number(params.get(key));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    likes: params.getAll("l").map((l) => l.trim()).filter(Boolean).slice(0, 8),
    filters: {
      maxTuitionUsd: num("tuition"),
      maxMonthlyUsd: num("budget"),
      languages: params.getAll("study").filter(Boolean),
      regions: params.getAll("region") as Region[],
    },
  };
}
