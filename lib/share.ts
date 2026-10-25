// Encodes a search (likes, filters, language) in URL params so results can be shared.
import type { Region } from "@/lib/cities";
import { isLang, type Lang } from "@/lib/i18n";
import type { MatchFilters } from "@/lib/agent/types";

export interface SearchState {
  likes: string[];
  filters: MatchFilters;
  lang: Lang;
}

export function toSearchParams(state: SearchState): URLSearchParams {
  const params = new URLSearchParams();
  state.likes.forEach((l) => params.append("l", l));
  if (state.lang !== "en") params.set("lang", state.lang);
  if (state.filters.maxTuitionUsd) params.set("tuition", String(state.filters.maxTuitionUsd));
  if (state.filters.maxMonthlyUsd) params.set("budget", String(state.filters.maxMonthlyUsd));
  if (state.filters.language) params.set("study", state.filters.language);
  state.filters.regions?.forEach((r) => params.append("region", r));
  return params;
}

export function fromSearchParams(params: URLSearchParams): SearchState {
  const num = (key: string) => {
    const n = Number(params.get(key));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  const lang = params.get("lang");
  return {
    likes: params.getAll("l").map((l) => l.trim()).filter(Boolean).slice(0, 8),
    lang: isLang(lang) ? lang : "en",
    filters: {
      maxTuitionUsd: num("tuition"),
      maxMonthlyUsd: num("budget"),
      language: params.get("study") || undefined,
      regions: params.getAll("region") as Region[],
    },
  };
}
