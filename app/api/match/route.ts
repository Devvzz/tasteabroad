// POST /api/match streams the agent's progress as newline-delimited JSON (one AgentEvent per line).
import { parseMatchRequest, requestKey } from "@/lib/agent/request";
import { AgentError, runAgent } from "@/lib/agent/run";
import type { AgentEvent, ErrorCode, MatchResult } from "@/lib/agent/types";

export const maxDuration = 60;

const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;
const RESULT_TTL_MS = 30 * 60_000;

// Per-instance memory: good enough to protect the free API quotas during a demo.
const hits = new Map<string, number[]>();
const results = new Map<string, { expires: number; result: MatchResult }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}

function errorCode(err: unknown): ErrorCode {
  if (err instanceof AgentError) return err.code;
  return "generic";
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const matchRequest = parseMatchRequest(body);
  if (!matchRequest) return Response.json({ type: "error", code: "badRequest" }, { status: 400 });

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = requestKey(matchRequest);
  const cached = results.get(key);
  const fresh = cached && cached.expires > Date.now() ? cached.result : undefined;
  if (!fresh && rateLimited(ip)) return Response.json({ type: "error", code: "rateLimited" }, { status: 429 });

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
        send({ type: "error", code: errorCode(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
