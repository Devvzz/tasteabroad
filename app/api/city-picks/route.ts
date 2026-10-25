// POST /api/city-picks: places in one city that people with the user's taste love (used by the compare view).
import { getCity } from "@/lib/cities";
import { placesNear, QlooError } from "@/lib/qloo";
import { clientIp, isRateLimited } from "@/lib/rate-limit";

const RATE_LIMIT = 20;
const MAX_IDS = 10;
const ENTITY_ID = /^[0-9A-F-]{36}$/i;
const TAG_ID = /^urn:tag:[a-z0-9_:.-]+$/i;

function ids(value: unknown, pattern: RegExp): string[] {
  return (Array.isArray(value) ? value : []).filter((v): v is string => typeof v === "string" && pattern.test(v)).slice(0, MAX_IDS);
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const city = typeof body?.cityId === "string" ? getCity(body.cityId) : undefined;
  const signals = { entityIds: ids(body?.entityIds, ENTITY_ID), tagIds: ids(body?.tagIds, TAG_ID) };
  if (!city || (!signals.entityIds.length && !signals.tagIds.length)) {
    return Response.json({ code: "badRequest" }, { status: 400 });
  }
  if (isRateLimited(`picks:${clientIp(request)}`, RATE_LIMIT)) {
    return Response.json({ code: "rateLimited" }, { status: 429 });
  }

  try {
    const places = await placesNear(signals, city.coordinates);
    return Response.json({ places: places.map((p) => ({ id: p.id, name: p.name, imageUrl: p.imageUrl })) });
  } catch (err) {
    const code = err instanceof QlooError && err.code === "rate_limited" ? "rateLimited" : "qloo";
    return Response.json({ code }, { status: 502 });
  }
}
