import { afterEach, describe, expect, it, vi } from "vitest";
import { checkSearchRateLimit, createMemoryLimiter } from "./rate-limit";

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("search budgets", () => {
  it("admits only twenty concurrent attempts and resets on expiry", async () => {
    let time = 0;
    const limit = createMemoryLimiter(() => time);
    const rule = [{ key: "user", limit: 20, seconds: 60 }];
    const results = await Promise.all(Array.from({ length: 100 }, async () => limit(rule)));
    expect(results.filter((r) => r.allowed)).toHaveLength(20);
    expect(results[99].retryAfter).toBe(60);
    time = 60_000;
    expect(limit(rule).allowed).toBe(true);
  });
  it("allows at most 200 per IP per day even after minute windows reset", () => {
    let time = 0;
    const limit = createMemoryLimiter(() => time);
    const rules = [
      { key: "user:minute", limit: 20, seconds: 60 },
      { key: "user:daily", limit: 200, seconds: 86400 },
    ];
    for (let batch = 0; batch < 10; batch++) {
      time = batch * 60_000;
      for (let index = 0; index < 20; index++) expect(limit(rules).allowed).toBe(true);
    }
    time = 600_000;
    expect(limit(rules)).toEqual({ allowed: false, retryAfter: 85800 });
    expect(limit([{ key: "other:minute", limit: 20, seconds: 60 }, { key: "other:daily", limit: 200, seconds: 86400 }]).allowed).toBe(true);
    time = 86_400_000;
    expect(limit(rules).allowed).toBe(true);
  });
  it("does not consume other budgets when one is exhausted", () => {
    const limit = createMemoryLimiter(() => 0);
    expect(limit([{ key: "global", limit: 1, seconds: 86400 }]).allowed).toBe(true);
    expect(limit([{ key: "user", limit: 1, seconds: 60 }, { key: "global", limit: 1, seconds: 86400 }]).allowed).toBe(false);
    expect(limit([{ key: "user", limit: 1, seconds: 60 }]).allowed).toBe(true);
  });
  it("blocks paid production searches without a shared store", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
    await expect(checkSearchRateLimit(new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.1" } }), true)).rejects.toThrow("Shared rate limiter");
  });
  it("uses one atomic Redis command and hashes the trusted IP", async () => {
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test-token");
    const fetch = vi.fn().mockResolvedValue(Response.json({ result: [0, 42] }));
    vi.stubGlobal("fetch", fetch);
    const request = new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.1", "x-forwarded-for": "spoofed" } });
    expect(await checkSearchRateLimit(request, true)).toEqual({ allowed: false, retryAfter: 42 });
    const command = JSON.parse(fetch.mock.calls[0][1].body);
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe(3);
    expect(command.slice(3, 6).join()).not.toContain("203.0.113.1");
    expect(command.slice(6)).toEqual([20, 60, 200, 86400, 500, 86400]);
    fetch.mockResolvedValueOnce(Response.json({ error: "Redis failed" }));
    await expect(checkSearchRateLimit(request, true)).rejects.toThrow("Invalid rate limit response");
  });
  it("rejects untrusted/missing IP identity on Vercel", async () => {
    vi.stubEnv("VERCEL", "1");
    await expect(checkSearchRateLimit(new Request("https://example.com", { headers: { "x-forwarded-for": "203.0.113.1" } }), true)).rejects.toThrow("trusted client IP");
  });
});
