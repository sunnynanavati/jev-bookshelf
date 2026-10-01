import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";

type Rule = { key: string; limit: number; seconds: number };
export type RateDecision = { allowed: boolean; retryAfter: number };

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
    // Bound memory in a long-lived instance. Eviction weakens already best-effort
    // quotas, but prevents unique-IP traffic from growing the map indefinitely.
    if (buckets.size + rules.length > 10_000) buckets.clear();
    for (const rule of rules) {
      const bucket = buckets.get(rule.key) ?? { count: 0, expires: time + rule.seconds * 1000 };
      bucket.count++;
      buckets.set(rule.key, bucket);
    }
    return { allowed: true, retryAfter: 0 };
  };
}

const localLimiter = createMemoryLimiter();
const identitySecret = randomBytes(32);

export async function checkSearchRateLimit(request: Request, paid: boolean): Promise<RateDecision> {
  const hosted = process.env.VERCEL === "1";
  // Only trust forwarded headers when running behind Vercel's trusted edge.
  const forwarded = hosted ? request.headers.get("x-vercel-forwarded-for")?.trim() : null;
  const ip = forwarded && isIP(forwarded) ? forwarded : "local-or-unknown";
  const identity = createHmac("sha256", identitySecret).update(ip).digest("hex");
  const prefix = `jev:search:${process.env.VERCEL_ENV || "local"}`;
  const rules: Rule[] = [
    { key: `${prefix}:${identity}:minute`, limit: 20, seconds: 60 },
    { key: `${prefix}:${identity}:daily`, limit: 200, seconds: 86400 },
  ];
  if (paid) rules.push({ key: `${prefix}:daily`, limit: 500, seconds: 86400 });
  // No external service: counters apply only to this warm process, not the fleet.
  return localLimiter(rules);
}
