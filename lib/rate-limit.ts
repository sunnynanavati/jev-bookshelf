import { createHmac } from "node:crypto";
import { isIP } from "node:net";

type Rule = { key: string; limit: number; seconds: number };
export type RateDecision = { allowed: boolean; retryAfter: number };

// Check every budget before incrementing any of them, atomically across instances.
const script = `
local retry = 0
for i, key in ipairs(KEYS) do
  if tonumber(redis.call('GET', key) or '0') >= tonumber(ARGV[i * 2 - 1]) then
    retry = math.max(retry, redis.call('TTL', key), 1)
  end
end
if retry > 0 then return {0, retry} end
for i, key in ipairs(KEYS) do
  local count = redis.call('INCR', key)
  if count == 1 then redis.call('EXPIRE', key, ARGV[i * 2]) end
end
return {1, 0}
`;

export function createMemoryLimiter(now = Date.now) {
  const buckets = new Map<string, { count: number; expires: number }>();
  return (rules: Rule[]): RateDecision => {
    const time = now();
    for (const [key, bucket] of buckets) if (bucket.expires <= time) buckets.delete(key);
    const blocked = rules.filter(({ key, limit }) => (buckets.get(key)?.count ?? 0) >= limit);
    if (blocked.length) return {
      allowed: false,
      retryAfter: Math.max(...blocked.map(({ key }) => Math.ceil((buckets.get(key)!.expires - time) / 1000))),
    };
    for (const rule of rules) {
      const bucket = buckets.get(rule.key) ?? { count: 0, expires: time + rule.seconds * 1000 };
      bucket.count++;
      buckets.set(rule.key, bucket);
    }
    return { allowed: true, retryAfter: 0 };
  };
}

const localLimiter = createMemoryLimiter();

export async function checkSearchRateLimit(request: Request, paid: boolean): Promise<RateDecision> {
  const hosted = process.env.VERCEL === "1";
  // Only trust forwarded headers when running behind Vercel's trusted edge.
  const ip = hosted ? request.headers.get("x-vercel-forwarded-for")?.trim() : "local";
  if (hosted && (!ip || !isIP(ip))) throw new Error("Missing trusted client IP");
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const production = process.env.NODE_ENV === "production";
  if (production && paid && (!hosted || !url || !token)) {
    throw new Error("Shared rate limiter required for production Jev searches");
  }
  const identity = createHmac("sha256", token || "local-development-only").update(ip || "local").digest("hex");
  const prefix = `jev:search:${process.env.VERCEL_ENV || "local"}`;
  const rules: Rule[] = [
    { key: `${prefix}:${identity}:minute`, limit: 10, seconds: 60 },
    { key: `${prefix}:${identity}:hour`, limit: 60, seconds: 3600 },
  ];
  if (paid) rules.push({ key: `${prefix}:daily`, limit: 500, seconds: 86400 });
  if (!url || !token) return localLimiter(rules);
  const endpoint = new URL(url);
  if (endpoint.protocol !== "https:" || !endpoint.hostname.endsWith(".upstash.io")) throw new Error("Invalid Redis endpoint");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(["EVAL", script, rules.length, ...rules.map(({ key }) => key), ...rules.flatMap(({ limit, seconds }) => [limit, seconds])]),
    signal: AbortSignal.timeout(2000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Rate limit store unavailable");
  const payload = await response.json() as { result?: unknown; error?: unknown };
  const result = payload.result;
  if (payload.error || !Array.isArray(result) || result.length !== 2
    || ![0, 1].includes(result[0]) || !Number.isInteger(result[1]) || result[1] < 0
    || (result[0] === 0 && result[1] < 1)) throw new Error("Invalid rate limit response");
  return { allowed: result[0] === 1, retryAfter: result[1] };
}
