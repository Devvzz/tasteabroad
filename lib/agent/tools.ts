// The tools the LLM agent can call. Each tool records what it found in AgentContext, so the final
// result is always assembled from real Qloo data, never from text the model made up.
import { cities, getCity, tuitionFor, type City } from "@/lib/cities";
import type { ToolDefinition } from "@/lib/llm";
import {
  searchEntities,
  searchTags,
  similarEntities,
  topDestinations,
  type EntityType,
  type QlooEntity,
  type TasteSignals,
} from "@/lib/qloo";
import { AgentError } from "./errors";
import { MAX_LIKES } from "./request";
import { rankCities, scoreTaste, type TasteScore } from "./scoring";
import type { AgentEvent, MatchRequest, NoteKey, ResolvedSignal, StepKey, TasteRank, TraceEntry } from "./types";

export const SEARCH_TYPES: EntityType[] = [
  "urn:entity:artist",
  "urn:entity:movie",
  "urn:entity:tv_show",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:place",
  "urn:entity:person",
  "urn:entity:videogame",
];
const SIMILAR_TYPES: EntityType[] = ["urn:entity:artist", "urn:entity:movie", "urn:entity:tv_show", "urn:entity:place"];
const MAX_ALSO_LIKED = 10;

export interface RankedCity {
  city: City;
  score: number;
  breakdown: TasteRank[];
}

/** Shared state for one agent run. */
export class AgentContext {
  /** Every entity/tag the searches returned, by ID, with the user input that produced it. */
  readonly candidates = new Map<string, ResolvedSignal>();
  selected: ResolvedSignal[] = [];
  ranked: RankedCity[] | null = null;
  /** The ranking before filters, so the map and city checker can show every city. */
  allRanked: RankedCity[] = [];
  worldwide: QlooEntity[] = [];
  alsoLiked: QlooEntity[] | null = null;
  /** Inputs Qloo recognised but has no city data for. */
  unscored: string[] = [];
  /** What the ranking was built from (bridge artists instead of bare genre tags), reused for place picks. */
  tasteSignals?: TasteSignals;
  /** Called once the cities are ranked, so the page can show them before the notes are written. */
  onRanked?: () => void;
  /** Per-taste scoring, started by whichever tool needs it first. */
  tastes?: Promise<TasteScore[]>;
  readonly notes = new Set<NoteKey>();
  readonly trace: TraceEntry[] = [];

  constructor(
    readonly request: MatchRequest,
    readonly emit: (event: AgentEvent) => void,
  ) {}

  signals(): TasteSignals {
    return {
      entityIds: this.selected.filter((s) => s.kind === "entity").map((s) => s.id),
      tagIds: this.selected.filter((s) => s.kind === "tag").map((s) => s.id),
    };
  }

  step(step: StepKey, status: "running" | "done" | "error", detail?: string) {
    this.emit({ type: "step", step, status, detail });
  }
}

// ---------- tool definitions (what the model sees) ----------

const idList = (description: string) => ({ type: "array", items: { type: "string" }, description });

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "qloo_search",
      description:
        "Resolve the user's free-text likes into Qloo entities (artists, films, shows, books, brands, places) and Qloo tags (genres, cuisines, hobbies). Returns candidates per query.",
      parameters: {
        type: "object",
        properties: { queries: { type: "array", items: { type: "string" }, description: "One entry per user like." } },
        required: ["queries"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "qloo_destination_affinity",
      description:
        "Rank university cities worldwide by Qloo taste affinity for the chosen entity and tag IDs. Also returns Qloo's top destinations worldwide. Applies the user's filters.",
      parameters: {
        type: "object",
        properties: {
          entity_ids: idList("Entity IDs chosen from qloo_search results."),
          tag_ids: idList("Tag IDs chosen from qloo_search results."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "qloo_similar",
      description:
        "'People like you also liked': other artists, films, TV shows and places with high affinity for the same taste signals.",
      parameters: {
        type: "object",
        properties: {
          entity_ids: idList("Entity IDs chosen from qloo_search results."),
          tag_ids: idList("Tag IDs chosen from qloo_search results."),
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_city_info",
      description:
        "Curated facts about one city: universities, typical international tuition, monthly student cost of living, teaching languages, student life.",
      parameters: {
        type: "object",
        properties: { city: { type: "string", description: "City id or name, e.g. 'berlin' or 'Mexico City'." } },
        required: ["city"],
      },
    },
  },
];

// ---------- tool implementations ----------

export async function qlooSearch(ctx: AgentContext, queries: string[]) {
  const unique = [...new Set(queries.map((q) => q.trim()).filter(Boolean))].slice(0, MAX_LIKES);
  return Promise.all(
    unique.map(async (query) => {
      const [entities, tags] = await Promise.all([searchEntities(query, SEARCH_TYPES, 3), searchTags(query, 3)]);
      for (const e of entities) {
        ctx.candidates.set(e.id, { input: query, id: e.id, name: e.name, kind: "entity", type: e.type });
      }
      for (const t of tags) {
        ctx.candidates.set(t.id, { input: query, id: t.id, name: t.name, kind: "tag", type: t.type });
      }
      return {
        query,
        entities: entities.map((e) => ({ id: e.id, name: e.name, type: e.type, popularity: round(e.popularity) })),
        tags: tags.map((t) => ({ id: t.id, name: t.name, type: t.type })),
      };
    }),
  );
}

/** Keep only IDs the searches actually returned, so the model cannot invent signals. */
function selectSignals(ctx: AgentContext, entityIds: string[] = [], tagIds: string[] = []): void {
  const chosen = [...entityIds, ...tagIds]
    .map((id) => ctx.candidates.get(id))
    .filter((s): s is ResolvedSignal => Boolean(s));
  if (chosen.length) ctx.selected = dedupeById(chosen);
  if (!ctx.selected.length) throw new Error("None of the IDs came from qloo_search. Call qloo_search first.");
}

function passesFilters(city: City, filters: MatchRequest["filters"]): boolean {
  if (filters.maxTuitionUsd !== undefined && tuitionFor(city, filters.euCitizen).min > filters.maxTuitionUsd) return false;
  if (filters.maxMonthlyUsd !== undefined && city.costOfLiving && city.costOfLiving.usdPerMonth.min > filters.maxMonthlyUsd) {
    return false;
  }
  if (filters.languages?.length) {
    const wanted = new Set(filters.languages.map((l) => l.toLowerCase()));
    if (!city.languages.some((l) => wanted.has(l.toLowerCase()))) return false;
  }
  if (filters.regions?.length && !filters.regions.includes(city.region)) return false;
  return true;
}


/**
 * The per-taste scoring, done once per run: the agent usually calls the city and "also liked" tools
 * in the same turn, and both need it.
 */
function tastesFor(ctx: AgentContext): Promise<TasteScore[]> {
  ctx.tastes ??= scoreEachTaste(ctx);
  return ctx.tastes;
}

/** Signals that carry taste for Qloo: the user's entities, the entities behind their tags, and food tags. */
function tasteSignals(tastes: TasteScore[], fallback: TasteSignals): TasteSignals {
  if (!tastes.length) return fallback;
  return {
    entityIds: [...new Set(tastes.flatMap((t) => t.used.entityIds.slice(0, 3)))].slice(0, 10),
    tagIds: [...new Set(tastes.flatMap((t) => t.used.tagIds))],
  };
}

/** Scores each distinct input on its own, marking which ones Qloo has city data for. */
async function scoreEachTaste(ctx: AgentContext): Promise<TasteScore[]> {
  const firstPerInput = ctx.selected.filter((s, i, all) => all.findIndex((o) => o.input === s.input) === i);
  const alternatives = (input: string) => [...ctx.candidates.values()].filter((c) => c.input === input);
  const results = await Promise.all(firstPerInput.map((s) => scoreTaste(s, alternatives(s.input))));

  ctx.selected = firstPerInput.map((s, i) => {
    const r = results[i];
    // When an alternative tag worked better, show that one.
    return r ? { ...r.signal, input: s.input, via: r.via, scored: true } : { ...s, scored: false };
  });
  ctx.unscored = ctx.selected.filter((s) => !s.scored).map((s) => s.input);
  if (ctx.unscored.length) ctx.notes.add("unscored");
  return results.filter((r): r is TasteScore => r !== null);
}


export async function qlooDestinationAffinity(ctx: AgentContext, entityIds?: string[], tagIds?: string[]) {
  selectSignals(ctx, entityIds, tagIds);
  const tastes = await tastesFor(ctx);

  // Without a single taste that has city data, every city gets the same score; say so instead of guessing.
  if (!tastes.length) throw new AgentError("noCityData");

  const ranked = rankCities(tastes);
  ctx.tasteSignals = tasteSignals(tastes, ctx.signals());
  const worldwide = await topDestinations(ctx.tasteSignals, 30);
  ctx.worldwide = worldwide;

  // If nothing passes every filter, relax the strictest ones first and keep the region as long as possible.
  const f = ctx.request.filters;
  const attempts: MatchRequest["filters"][] = [f, { regions: f.regions, languages: f.languages }, { regions: f.regions }, {}];
  ctx.allRanked = ranked;
  ctx.ranked = ranked;
  for (const [i, attempt] of attempts.entries()) {
    const passing = ranked.filter((r) => passesFilters(r.city, attempt));
    if (!passing.length) continue;
    ctx.ranked = passing;
    if (i > 0) ctx.notes.add("filtersRelaxed");
    break;
  }
  ctx.onRanked?.();

  const datasetIds = new Set(cities.map((c) => c.qlooId));
  return {
    ranked_cities: ctx.ranked.slice(0, 8).map((r) => ({
      city_id: r.city.id,
      name: r.city.name,
      country: r.city.country,
      match_score: r.score,
      rank_per_taste: r.breakdown.map((b) => `${b.taste} #${b.rank}/${b.of}`).join(", "),
    })),
    tastes_without_city_data: ctx.unscored,
    worldwide_top: worldwide
      .filter((d) => !datasetIds.has(d.id))
      .slice(0, 8)
      .map((d) => ({ name: d.name, country_code: d.countryCode, match_score: toScore(d.affinity) })),
    notes: [...ctx.notes],
  };
}

export async function qlooSimilar(ctx: AgentContext, entityIds?: string[], tagIds?: string[]) {
  selectSignals(ctx, entityIds, tagIds);
  // Bare tags are slow and vague here too, so use the same taste signals as the city ranking.
  const tastes = await tastesFor(ctx);
  const signals = tasteSignals(tastes, ctx.signals());
  const lists = await Promise.all(
    SIMILAR_TYPES.map((type) => similarEntities(signals, type, 4).catch(() => [] as QlooEntity[])),
  );
  // Leave out the user's own picks and the names their tags were scored through.
  const exclude = new Set([...ctx.selected.map((s) => s.id), ...signals.entityIds]);
  ctx.alsoLiked = interleave(lists).filter((e) => !exclude.has(e.id)).slice(0, MAX_ALSO_LIKED);
  return ctx.alsoLiked.map((e) => ({ name: e.name, type: e.type }));
}

export function getCityInfo(ctx: AgentContext, name: string) {
  const city = getCity(name) ?? cities.find((c) => c.name.toLowerCase().includes(name.toLowerCase()));
  if (!city) throw new Error(`Unknown city "${name}". Known ids: ${cities.map((c) => c.id).join(", ")}`);
  const score = ctx.ranked?.find((r) => r.city.id === city.id)?.score;
  return {
    id: city.id,
    name: city.name,
    country: city.country,
    match_score: score,
    universities: city.universities.map((u) => u.name),
    tuition: city.tuition.label,
    cost_of_living_usd_per_month: city.costOfLiving?.usdPerMonth ?? "unknown",
    languages: city.languages,
    student_life: city.studentLife,
  };
}

// ---------- dispatch ----------

const TOOL_STEPS: Record<string, StepKey> = {
  qloo_search: "search",
  qloo_destination_affinity: "match",
  qloo_similar: "similar",
  get_city_info: "cities",
};

type ToolArgs = { queries?: string[]; entity_ids?: string[]; tag_ids?: string[]; city?: string };

/** Run one tool call from the model, emit progress, and return a JSON string for the model. */
export async function executeTool(ctx: AgentContext, name: string, rawArgs: string): Promise<string> {
  const started = Date.now();
  const step = TOOL_STEPS[name];
  if (step) ctx.step(step, "running");
  let ok = true;
  let args: ToolArgs = {};
  try {
    args = (rawArgs ? JSON.parse(rawArgs) : {}) as ToolArgs;
    const output = await runTool(ctx, name, args);
    if (step) ctx.step(step, "done", detailFor(ctx, name));
    return JSON.stringify(output);
  } catch (err) {
    ok = false;
    if (step) ctx.step(step, "error");
    // Qloo outages are not something the model can fix; let the runner handle them.
    if (err instanceof Error && (err.name === "QlooError" || err.name === "AgentError")) throw err;
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  } finally {
    const entry = { tool: name, args: rawArgs.slice(0, 300), ms: Date.now() - started, ok, info: traceInfo(name, args) };
    ctx.trace.push(entry);
    ctx.emit({ type: "tool", entry });
  }
}

/** What the readable log needs to describe a call, without the raw IDs. */
function traceInfo(name: string, args: ToolArgs): TraceEntry["info"] {
  switch (name) {
    case "qloo_search":
      return { items: args.queries ?? [], count: args.queries?.length ?? 0 };
    case "qloo_destination_affinity":
      return { count: cities.length };
    case "get_city_info": {
      const city = args.city ? getCity(args.city) : undefined;
      return { items: [city?.name ?? args.city ?? "?"] };
    }
    default:
      return undefined;
  }
}

function runTool(ctx: AgentContext, name: string, args: ToolArgs): Promise<unknown> | unknown {
  switch (name) {
    case "qloo_search":
      return qlooSearch(ctx, args.queries ?? []);
    case "qloo_destination_affinity":
      return qlooDestinationAffinity(ctx, args.entity_ids, args.tag_ids);
    case "qloo_similar":
      return qlooSimilar(ctx, args.entity_ids, args.tag_ids);
    case "get_city_info":
      return getCityInfo(ctx, args.city ?? "");
    default:
      throw new Error(`Unknown tool ${name}`);
  }
}

function detailFor(ctx: AgentContext, name: string): string | undefined {
  if (name === "qloo_destination_affinity") return ctx.ranked?.slice(0, 3).map((r) => r.city.name).join(", ");
  if (name === "qloo_similar") return `${ctx.alsoLiked?.length ?? 0}`;
  return undefined;
}

// ---------- helpers ----------

export function toScore(affinity: number | undefined): number {
  return Math.round((affinity ?? 0) * 100);
}

function round(n: number | undefined): number | undefined {
  return n === undefined ? undefined : Math.round(n * 100) / 100;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((i) => [i.id, i])).values()];
}

function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const list of lists) if (i < list.length) out.push(list[i]);
  }
  return out;
}
