// Per-instance, in-memory rate limiting: good enough to protect free API quotas during a demo.

const WINDOW_MS = 60_000;
const buckets = new Map<string, number[]>();

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

/** Records a hit and returns true when `key` made more than `limit` requests in the last minute. */
export function isRateLimited(key: string, limit: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  buckets.set(key, recent);
  return recent.length > limit;
}
