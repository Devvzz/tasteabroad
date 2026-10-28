// Saved results for the example searches. Used when DEMO_ONLY is set, when someone opens an example,
// and as a fallback when Qloo or the model is unavailable, so the page never ends on an error.
import examples from "@/data/demo/examples.json";
import type { MatchResult } from "@/lib/agent/types";

export interface DemoPlace {
  id: string;
  name: string;
  category?: string;
  neighborhood?: string;
  description?: string;
  city: string;
}

interface DemoFile {
  sets: Record<string, MatchResult>;
  picks: Record<string, Record<string, DemoPlace[]>>;
}

const data = examples as unknown as DemoFile;

export function demoOnly(): boolean {
  return process.env.DEMO_ONLY === "true";
}

/** The saved example that shares the most likes with the search (the first one if none match). */
export function demoResult(likes: string[], reason: "example" | "fallback"): MatchResult {
  const wanted = new Set(likes.map((l) => l.toLowerCase()));
  const entries = Object.values(data.sets);
  let best = entries[0];
  let bestOverlap = -1;
  for (const result of entries) {
    const overlap = result.likes.filter((l) => wanted.has(l.toLowerCase())).length;
    if (overlap > bestOverlap) {
      best = result;
      bestOverlap = overlap;
    }
  }
  return { ...best, demo: reason };
}

/** Saved compare-view places for a city, from whichever example ranked it near the top. */
export function demoPlaces(cityId: string): DemoPlace[] {
  for (const picks of Object.values(data.picks)) {
    if (picks[cityId]?.length) return picks[cityId];
  }
  return [];
}
