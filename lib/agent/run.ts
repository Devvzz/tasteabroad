// Runs the TasteAbroad agent: the LLM plans and calls Qloo tools; if the LLM is unavailable,
// a fixed pipeline calls the same tools so the user always gets a result.
import { t } from "@/lib/i18n";
import { chat, type ChatMessage } from "@/lib/llm";
import { QlooError } from "@/lib/qloo";
import {
  AgentContext,
  executeTool,
  qlooDestinationAffinity,
  qlooSearch,
  qlooSimilar,
  TOOL_DEFINITIONS,
  type RankedCity,
} from "./tools";
import { AgentError } from "./errors";
import { pickSignal } from "./pick";
import { bestValue, buildRanking } from "./ranking";
import type { AgentEvent, CityMatch, MatchRequest, MatchResult, ResolvedSignal } from "./types";

const MAX_TURNS = 6;
const TOP_N = 5;
// The writer uses a different model than the planner so the two share the free quota load.
// It has the most generous time budget, so the slower model is fine here.
const WRITER_MODEL = "gemini-3.1-flash-lite";
// Time budget (from the start of the run) so the whole request stays under the 60s function limit.
// The agent needs two raced steps, under 10s when Gemini is fine; past 20s it is stuck on hangs, and the
// fixed pipeline shows the cities sooner.
const AGENT_BUDGET_MS = 20_000;
const WRITER_BUDGET_MS = 48_000;

export { AgentError };

export async function runAgent(request: MatchRequest, emit: (event: AgentEvent) => void): Promise<MatchResult> {
  const ctx = new AgentContext(request, emit);
  const startedAt = Date.now();
  let mode: MatchResult["mode"] = "agent";
  // Show the ranked cities right away, and start writing their notes at once: the writer only needs the
  // ranking, and Gemini can be slow, so it gets every second until the deadline instead of waiting its turn.
  let early: { top: RankedCity[]; notes: Promise<CityMatch[]> } | undefined;
  ctx.onRanked = () => {
    ctx.onRanked = undefined;
    const top = ctx.ranked!.slice(0, TOP_N);
    const placeholders = top.map((r) => ({ ...r, why: "", studentLife: "", pending: true }));
    emit({ type: "partial", result: assemble(ctx, placeholders, mode) });
    ctx.step("explain", "running");
    early = { top, notes: explain(ctx, top, startedAt + WRITER_BUDGET_MS) };
  };

  try {
    ctx.step("plan", "running");
    await agentLoop(ctx, startedAt + AGENT_BUDGET_MS);
  } catch (err) {
    if (err instanceof QlooError) throw toAgentError(err);
    if (err instanceof AgentError) throw err;
    console.warn("agent loop stopped, using fixed pipeline:", err instanceof Error ? err.message : err);
    // Only report a fallback when the pipeline actually has to take over work.
    if (!ctx.ranked || !ctx.alsoLiked) {
      mode = "fallback";
      ctx.step("fallback", "running");
    }
  }

  // Fill in anything the model skipped (or everything, if it failed).
  try {
    await completePipeline(ctx);
  } catch (err) {
    if (err instanceof QlooError) throw toAgentError(err);
    throw err;
  }
  if (!ctx.ranked?.length) throw new AgentError("noTaste");

  const top = ctx.ranked.slice(0, TOP_N);
  // Reuse the early notes unless the agent ranked again and the top cities changed since.
  const sameTop = early?.top.length === top.length && early.top.every((r, i) => r.city.id === top[i].city.id);
  if (!sameTop) ctx.step("explain", "running");
  const cities = sameTop ? await early!.notes : await explain(ctx, top, startedAt + WRITER_BUDGET_MS);
  ctx.step("explain", "done");

  return assemble(ctx, cities, mode);
}

/** The result as the page sees it, built from what the run has found so far. */
function assemble(ctx: AgentContext, cities: CityMatch[], mode: MatchResult["mode"]): MatchResult {
  const { request } = ctx;
  const ranked = ctx.ranked ?? [];
  const resolvedInputs = new Set(ctx.selected.map((s) => s.input.toLowerCase()));
  const unresolved = request.likes.filter((l) => !resolvedInputs.has(l.toLowerCase()));
  if (unresolved.length) ctx.notes.add("unresolved");

  return {
    likes: request.likes,
    filters: request.filters,
    resolved: ctx.selected,
    unresolved,
    unscored: ctx.unscored,
    cities,
    ranking: buildRanking(ctx.allRanked.length ? ctx.allRanked : ranked, ranked, request.filters.euCitizen),
    bestValueId: bestValue(ranked, request.filters.euCitizen),
    alsoLiked: (ctx.alsoLiked ?? []).map((e) => ({ id: e.id, name: e.name, type: e.type, imageUrl: e.imageUrl })),
    tasteSignals: ctx.tasteSignals,
    worldwide: worldwideExtras(ctx),
    notes: [...ctx.notes],
    // A copy, so the partial result does not keep growing as later tools are logged.
    trace: [...ctx.trace],
    mode,
  };
}

// ---------- LLM agent loop ----------

function systemPrompt(req: MatchRequest): string {
  const f = req.filters;
  const filters = [
    f.maxTuitionUsd !== undefined && `max tuition ${f.maxTuitionUsd} USD/year`,
    f.euCitizen && "has an EU/EEA passport (lower fees in much of Europe)",
    f.maxMonthlyUsd !== undefined && `max living costs ${f.maxMonthlyUsd} USD/month`,
    f.languages?.length && `can study in ${f.languages.join(" or ")}`,
    f.regions?.length && `regions ${f.regions.join(", ")}`,
  ].filter(Boolean);
  return [
    "You are the TasteAbroad agent. You help students find university cities abroad whose culture fits their taste.",
    "Work only through the tools, in this order:",
    "1. Call qloo_search once with all of the user's likes.",
    "2. For each like, choose the single best match: an entity when the like names a specific artist, film, show, brand or place; a tag when it is a genre, cuisine or hobby (e.g. 'techno', 'street food', 'hiking'). Skip likes with no sensible match.",
    "3. In ONE turn, call qloo_destination_affinity and qloo_similar with the same chosen IDs.",
    "4. Call get_city_info for each of the top 5 ranked cities (parallel calls in one turn).",
    "5. Reply with a one-line summary. Do not invent IDs, cities or numbers.",
    `User filters: ${filters.length ? filters.join("; ") : "none"}.`,
  ].join("\n");
}

async function agentLoop(ctx: AgentContext, deadline: number): Promise<void> {
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx.request) },
    { role: "user", content: `My likes: ${ctx.request.likes.map((l) => `"${l}"`).join(", ")}` },
  ];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    // Raced like the notes: a step that hangs on one model would otherwise eat a third of the time budget.
    const reply = await chat({ messages, tools: TOOL_DEFINITIONS, temperature: 0.2, deadline, hedge: true });
    if (turn === 0) ctx.step("plan", "done");
    messages.push(reply);
    const calls = reply.tool_calls ?? [];
    if (!calls.length) return;

    const outputs = await Promise.all(calls.map((call) => executeTool(ctx, call.function.name, call.function.arguments)));
    calls.forEach((call, i) => messages.push({ role: "tool", tool_call_id: call.id, content: outputs[i] }));

    // Once cities are ranked and similar items found, the model's remaining steps only read our own city
    // data (the pipeline does that anyway) and write a summary nobody sees. Each would cost a Gemini call.
    if (ctx.ranked && ctx.alsoLiked) return;
  }
}

// ---------- fixed pipeline (fills gaps / replaces the LLM) ----------

/** The fixed pipeline's choice of Qloo match for each like (see pickSignal). */
function pickSignals(ctx: AgentContext): ResolvedSignal[] {
  const byInput = new Map<string, ResolvedSignal[]>();
  for (const c of ctx.candidates.values()) byInput.set(c.input, [...(byInput.get(c.input) ?? []), c]);
  return [...byInput].map(([input, options]) => pickSignal(input, options)).filter((p): p is ResolvedSignal => Boolean(p));
}

async function completePipeline(ctx: AgentContext): Promise<void> {
  if (!ctx.candidates.size) {
    ctx.step("search", "running");
    await qlooSearch(ctx, ctx.request.likes);
    ctx.step("search", "done");
  }
  if (!ctx.selected.length) ctx.selected = pickSignals(ctx);
  if (!ctx.selected.length) throw new AgentError("noTaste");

  const ids = { entity: ctx.signals().entityIds, tag: ctx.signals().tagIds };
  const pending: Promise<unknown>[] = [];
  if (!ctx.ranked) {
    ctx.step("match", "running");
    pending.push(qlooDestinationAffinity(ctx, ids.entity, ids.tag).then(() => ctx.step("match", "done")));
  }
  if (!ctx.alsoLiked) {
    ctx.step("similar", "running");
    pending.push(
      qlooSimilar(ctx, ids.entity, ids.tag)
        .then(() => ctx.step("similar", "done"))
        .catch(() => ctx.step("similar", "error")),
    );
  }
  await Promise.all(pending);
  ctx.step("cities", "done");
}

// ---------- explanations ----------

async function explain(ctx: AgentContext, top: RankedCity[], deadline: number): Promise<CityMatch[]> {
  const fallback = (r: RankedCity): CityMatch => {
    // Name the taste this city ranks best for, so each card says something different.
    const best = [...r.breakdown].sort((a, b) => a.rank - b.rank)[0];
    const why = best
      ? t("fallback.whyBest", { taste: best.taste, rank: best.rank, of: best.of, city: r.city.name })
      : t("fallback.why", {
          likes: ctx.selected.filter((s) => s.scored !== false).slice(0, 3).map((s) => s.input).join(", "),
          score: r.score,
          city: r.city.name,
        });
    return { ...r, why, studentLife: t("fallback.studentLife", { tags: r.city.studentLife.slice(0, 3).join(", ") }) };
  };

  try {
    const written = await writeExplanations(ctx, top, deadline);
    return top.map((r) => {
      const w = written.get(r.city.id);
      return w ? { ...r, ...w } : fallback(r);
    });
  } catch (err) {
    console.warn("explanation writer failed, using templates:", err instanceof Error ? err.message.slice(0, 200) : err);
    ctx.notes.add("llmFallback");
    return top.map(fallback);
  }
}

async function writeExplanations(ctx: AgentContext, top: RankedCity[], deadline: number) {
  const payload = {
    // Only tastes that actually shaped the ranking, so the notes never credit a city for a taste that did not count.
    user_likes: ctx.selected.filter((s) => s.scored !== false).map((s) => ({ typed: s.input, qloo_match: s.name, kind: s.kind })),
    cities: top.map((r) => ({
      id: r.city.id,
      name: r.city.name,
      country: r.city.country,
      match_score: r.score,
      rank_per_taste: r.breakdown.map((b) => `${b.taste}: #${b.rank} of ${b.of} cities`),
      student_life: r.city.studentLife,
      languages: r.city.languages,
    })),
    also_liked: (ctx.alsoLiked ?? []).slice(0, 6).map((e) => e.name),
  };
  const reply = await chat({
    json: true,
    temperature: 0.6,
    model: process.env.LLM_WRITER_MODEL || WRITER_MODEL,
    // Two models race and the first good answer wins.
    hedge: true,
    deadline,
    messages: [
      {
        role: "system",
        content: [
          "Write in English, like a well-travelled friend texting advice: plain, specific, a little dry. No hype.",
          "For each city write:",
          "- why: 2 short sentences on why this city's culture fits the user. Mention at least one of the user's likes by name, preferring the ones where the city ranks best (rank_per_taste). The scores and ranks are shown separately, so do not repeat numbers. Talk about what people with similar tastes enjoy, not predictions about the user.",
          "- studentLife: 1 short sentence about student life there.",
          "Open with something concrete about the city (a place, a habit, a scene), not with '<city> is'. Start each city's note differently.",
          "Never use these words or phrases: destination, premier, perfect, paradise, dream, hub, haven, vibrant, bustling, rich tapestry, nestled, gem, lovers, enthusiasts, offers, boasts, aligns, ensures, your interests, look no further, something for everyone, whether you.",
          "Only state things about a city that are well known. If a taste has no obvious link to the city (fado in Barcelona), say that people who like it rate the city highly instead of inventing a scene, venue or tradition.",
          "Do not invent numbers, prices or rankings. Do not use long dashes.",
          'Return JSON: {"cities":[{"id":"...","why":"...","studentLife":"..."}]}',
        ].join("\n"),
      },
      { role: "user", content: JSON.stringify(payload) },
    ],
  });

  const parsed = JSON.parse(reply.content ?? "{}") as { cities?: { id?: string; why?: string; studentLife?: string }[] };
  const out = new Map<string, { why: string; studentLife: string }>();
  for (const c of parsed.cities ?? []) {
    if (c.id && c.why && c.studentLife) out.set(c.id, { why: c.why.trim(), studentLife: c.studentLife.trim() });
  }
  if (!out.size) throw new Error("Empty explanations");
  return out;
}

// ---------- helpers ----------

function worldwideExtras(ctx: AgentContext): MatchResult["worldwide"] {
  const seen = new Set(ctx.ranked?.map((r) => r.city.name.toLowerCase()));
  const out: MatchResult["worldwide"] = [];
  for (const d of ctx.worldwide) {
    const key = d.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: d.name, countryCode: d.countryCode });
    if (out.length === 6) break;
  }
  return out;
}

function toAgentError(err: QlooError): AgentError {
  return new AgentError(err.code === "rate_limited" ? "rateLimited" : "qloo");
}
