// GET /api/check-like?q=hiking: tells the page right away whether Qloo can rank cities for one like.
import { checkLike } from "@/lib/agent/check";
import { cleanLike } from "@/lib/agent/request";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

// Enough for someone adding all 12 likes quickly, plus a few retypes.
const RATE_LIMIT = 30;
const MIN_LENGTH = 2;
const MAX_LENGTH = 60;

export async function GET(request: Request) {
  // Cleaned the same way as a search, so the hint matches what the search will do.
  const query = cleanLike(new URL(request.url).searchParams.get("q") ?? "");
  if (query.length < MIN_LENGTH || query.length > MAX_LENGTH) return Response.json({ status: "unknown" });
  if (isRateLimited(`check:${clientIp(request)}`, RATE_LIMIT)) return Response.json({ status: "unknown" }, { status: 429 });

  try {
    return Response.json(await checkLike(query));
  } catch {
    // The check is only a hint; if Qloo is busy the search itself still reports it.
    return Response.json({ status: "unknown" });
  }
}
