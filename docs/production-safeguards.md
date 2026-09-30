# Production safeguards

## What changed

Before this change, search checked query length and kept the Jev key server-side, but had no request rate limit. The new route rejects non-string/empty/overlong queries, malformed JSON, bodies above 4 KiB (including streamed bodies), non-JSON content types and cross-site browser requests before calling Jev. Next.js handles unsupported HTTP methods. Responses are not cached; provider errors and credentials are not logged verbatim. Text renders through React rather than HTML injection; Jev can only rank known candidate IDs, not execute actions.

Security headers disable framing, MIME sniffing and unused camera/microphone/location permissions. These are baseline protections, not a complete security certification or a strict script Content Security Policy.

## Shared limits and setup — required before merging/deploying

1. Create or connect an **Upstash Redis** database through Vercel's Storage/Marketplace, or directly in Upstash. Choose a suitable region and review its pricing. No account/database is created by the code.
2. Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from that database to the Vercel project's server environment. Use a read/write token (the limiter runs an atomic Lua script). Never use a `NEXT_PUBLIC_` prefix or paste secrets into GitHub/issues/chat.
3. Configure Production and any Preview environment that has a TypeSafe key. Preview and production counters are separated by `VERCEL_ENV`. Projects sharing one database and environment share budgets; use a separate database for unrelated apps.
4. Redeploy after setting the variables. Test a staging/preview deployment, including a burst of 11 valid searches: the first 10 may proceed, the 11th should return 429 with `Retry-After`, without calling Jev. This is a paid verification if a real key is enabled. Confirm counter keys/expiry in Redis and no credentials in logs.

Defaults (in `lib/rate-limit.ts`):

| Budget | Limit | Window |
| --- | --- | --- |
| Per IP | 10 searches | 60 seconds |
| Per IP | 60 searches | 3,600 seconds |
| All paid searches | 500 admitted searches | 86,400 seconds |

Windows begin on first admitted use, not at midnight. An atomic Redis script checks all budgets before consuming them, preventing parallel server instances from each granting a fresh allowance. Rejected requests do not consume other budgets. Provider failures still consume an allowance; SDK transient retries can mean multiple upstream attempts per admitted search, so this is **not a dollar spending cap**.

Only Vercel's `x-vercel-forwarded-for` identity is trusted on Vercel. Raw IPs are not stored: identifiers are HMAC-hashed using the server-only Redis token. Token rotation resets IP identities; network changes/rotating IPs can bypass individual quotas. Users sharing Wi-Fi may share a quota. Other hosting requires a separately reviewed trusted-proxy/IP integration.

Paid production searches **fail closed with 503** if the shared store, identity or configuration is unavailable. They never silently fall back to per-instance memory. Local development and keyless offline demos can use an in-memory limiter; that fallback is not distributed protection. Local `next start` with a real TypeSafe key also fails closed because it is not behind the supported Vercel proxy; use `npm run dev` for local live-provider testing.

## Responsive verification and CI

```bash
npm ci
npx playwright install chromium webkit
npm test
npx tsc --noEmit
npm run build
npm run test:e2e
```

Playwright runs against `next start` on port 3100 with credentials cleared. Search responses and cover images are mocked, so browser checks are deterministic and do not spend Jev credits. Chromium and WebKit cover 320×568, 375×812, 390×844, 768×1024, 844×390, 1280×600, 1440×900 and 1920×1080. Checks assert shelf-loop coverage, bounded shelf DOM, no page horizontal overflow, no caption clipping/overlap, visible search field, refine/clear behavior, 0px→2.25px→0px blur, production dev-control absence, rate-limit feedback and security headers. Additional checks cover live resizing, reduced motion and no-match responses.

GitHub `Quality checks` runs unit tests, TypeScript, dependency audit, a production build and browser tests. The HTML report includes result screenshots; failures retain screenshots/traces. **Screenshots are review artifacts, not pixel-baseline regression comparisons.** Review them before merging. Weekly Dependabot PRs cover npm and GitHub Actions.

Repository administrators must separately enable branch protection/rulesets requiring the `quality` check before merging main. A workflow file alone does not block merges or Vercel deploys. Do not merge this branch until shared-limiter variables are set. Test a real Android phone and iPhone/Safari on the preview: emulation cannot fully reproduce mobile keyboards, browser chrome, OS text scaling or touch scrolling.

## Remaining production work

- Enable/review Vercel firewall and bot protection for `/api/search`, blocking abuse before it incurs function/Redis work. App-layer limits are not DDoS protection, authentication or a complete bot defense. Cross-site origin checks do not prevent direct scripts/curl.
- Set provider-side spend controls/billing alerts and monitor 429/503/502 rates, latency and Redis availability. Decide whether to add CAPTCHA/challenges after observed abuse.
- Review previews so untrusted contributors cannot access production secrets. Avoid testing CI with real TypeSafe credentials.
- Keep dependencies patched and review audit alerts; an empty advisory report does not prove absence of vulnerabilities. Strict CSP, broader accessibility/manual device testing and shared-store integration testing remain separate follow-ups.

References: [Vercel request headers](https://vercel.com/docs/headers/request-headers), [Upstash REST API](https://upstash.com/docs/redis/features/restapi).
