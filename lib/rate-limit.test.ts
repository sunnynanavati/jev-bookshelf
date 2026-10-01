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
  it("allows paid production searches without an external store and enforces the minute budget", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.1" } });
    for (let index = 0; index < 20; index++) expect((await checkSearchRateLimit(request, true)).allowed).toBe(true);
    expect((await checkSearchRateLimit(request, true)).allowed).toBe(false);
  });
  it("keeps IP budgets separate and does not trust spoofable forwarding headers", async () => {
    vi.stubEnv("VERCEL", "1");
    const request = new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.2" } });
    for (let index = 0; index < 20; index++) expect((await checkSearchRateLimit(request, false)).allowed).toBe(true);
    const spoofed = new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.2", "x-forwarded-for": "203.0.113.3" } });
    expect((await checkSearchRateLimit(spoofed, false)).allowed).toBe(false);
    expect((await checkSearchRateLimit(new Request("https://example.com", { headers: { "x-vercel-forwarded-for": "203.0.113.3" } }), false)).allowed).toBe(true);
  });
  it("uses an anonymous bucket when a trusted identity is unavailable", async () => {
    vi.stubEnv("VERCEL", "1");
    expect((await checkSearchRateLimit(new Request("https://example.com"), false)).allowed).toBe(true);
  });
});
