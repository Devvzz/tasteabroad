// Checks one like on its own, the same way a search scores it, so the page can warn before the search runs.
import { searchEntities, searchTags } from "@/lib/qloo";
import { pickSignal } from "./pick";
import { scoreTaste } from "./scoring";
import { SEARCH_TYPES } from "./tools";
import type { ResolvedSignal } from "./types";

export type LikeStatus = "ok" | "noCityData" | "notFound";

export async function checkLike(input: string): Promise<{ status: LikeStatus; match?: string }> {
  const [entities, tags] = await Promise.all([searchEntities(input, SEARCH_TYPES, 3), searchTags(input, 3)]);
  const options: ResolvedSignal[] = [
    ...entities.map((e) => ({ input, id: e.id, name: e.name, kind: "entity" as const, type: e.type })),
    ...tags.map((t) => ({ input, id: t.id, name: t.name, kind: "tag" as const, type: t.type })),
  ];
  const pick = pickSignal(input, options);
  if (!pick) return { status: "notFound" };
  // Qloo answers are cached, so the real search reuses this work and starts faster.
  const taste = await scoreTaste(pick, options);
  return { status: taste ? "ok" : "noCityData", match: (taste?.signal ?? pick).name };
}
