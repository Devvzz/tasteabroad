// POST /api/match streams the agent's progress as newline-delimited JSON (one AgentEvent per line).
import { parseMatchRequest, requestKey } from "@/lib/agent/request";
import { AgentError, runAgent } from "@/lib/agent/run";
import type { AgentEvent, ErrorCode, MatchResult } from "@/lib/agent/types";
import { demoOnly, demoResult } from "@/lib/demo";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

export const maxDuration = 60;

const RATE_LIMIT = 8;
const RESULT_TTL_MS = 30 * 60_000;

const results = new Map<string, { expires: number; result: MatchResult }>();

function errorCode(err: unknown): ErrorCode {
  if (err instanceof AgentError) return err.code;
  return "generic";
}

// These come from the user's input, so a saved example would not answer them. Everything else
// (Qloo down, expired key, rate limits) falls back to the closest saved example.
const INPUT_ERRORS: ErrorCode[] = ["noTaste", "noCityData", "badRequest"];

const NDJSON_HEADERS = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" };

function demoResponse(likes: string[], reason: "example" | "fallback"): Response {
  const line = JSON.stringify({ type: "result", result: demoResult(likes, reason) } satisfies AgentEvent) + "\n";
  return new Response(line, { headers: NDJSON_HEADERS });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const matchRequest = parseMatchRequest(body);
  if (!matchRequest) return Response.json({ type: "error", code: "badRequest" }, { status: 400 });

  if (demoOnly() || (body as { demo?: unknown }).demo === true) return demoResponse(matchRequest.likes, "example");

  const key = requestKey(matchRequest);
  const cached = results.get(key);
  const fresh = cached && cached.expires > Date.now() ? cached.result : undefined;
  if (!fresh && isRateLimited(`match:${clientIp(request)}`, RATE_LIMIT)) {
    return demoResponse(matchRequest.likes, "fallback");
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const result = fresh ?? (await runAgent(matchRequest, send));
        if (!fresh) results.set(key, { expires: Date.now() + RESULT_TTL_MS, result });
        send({ type: "result", result });
      } catch (err) {
        console.error("match failed:", err instanceof Error ? err.message : err);
        const code = errorCode(err);
        if (INPUT_ERRORS.includes(code)) send({ type: "error", code });
        else send({ type: "result", result: demoResult(matchRequest.likes, "fallback") });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: NDJSON_HEADERS });
}
