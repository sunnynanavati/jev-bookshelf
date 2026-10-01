# Production safeguards

## What changed

Before this change, search checked query length and kept the Jev key server-side, but had no request rate limit. The new route rejects non-string/empty/overlong queries, malformed JSON, bodies above 4 KiB (including streamed bodies), non-JSON content types and cross-site browser requests before calling Jev. Next.js handles unsupported HTTP methods. Responses are not cached; provider errors and credentials are not logged verbatim. Text renders through React rather than HTML injection; Jev can only rank known candidate IDs, not execute actions.

Security headers disable framing, MIME sniffing and unused camera/microphone/location permissions. These are baseline protections, not a complete security certification or a strict script Content Security Policy.

## Best-effort limits — no additional setup

This hobby demo uses an in-memory limiter. The existing server-only `TYPESAFE_API_KEY` is sufficient; no Upstash/Redis account, credentials or network calls are needed.

Defaults (in `lib/rate-limit.ts`):

| Budget | Limit | Window |
| --- | --- | --- |
| Per IP | 20 searches | 60 seconds |
| Per IP | 200 searches | 86,400 seconds |
| Paid searches per server instance | 500 admitted searches | 86,400 seconds |

All budgets are **per warm server process**, not shared across Vercel's fleet. Windows begin on first admitted use, not at midnight. Minute and daily budgets are checked synchronously before incrementing; rejected searches do not consume other budgets. Provider failures still consume an allowance, and SDK retries can mean multiple upstream attempts per search.

Only Vercel's `x-vercel-forwarded-for` identity is trusted on Vercel. Raw IPs are not stored: identifiers are HMAC-hashed using a random process-local secret. Requests without a trusted valid IP share an anonymous bucket; outside Vercel, forwarded headers are ignored. Users sharing Wi-Fi may share a quota.

Counters disappear on process restarts/cold starts, differ between instances, and can be evicted if the map exceeds its 10,000-entry budget. Rotating IPs can also bypass individual quotas. Therefore **20/minute, 200/day and 500 paid/day are best-effort thresholds, not guaranteed site-wide or spending caps**. The project owner explicitly accepted this trade-off to keep the demo simple. Provider-side credit/spend limits remain the financial backstop. Local `next start` with a TypeSafe key works without extra configuration.

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

Repository administrators must separately enable branch protection/rulesets requiring the `quality` check before merging main. A workflow file alone does not block merges or Vercel deploys. Test a real Android phone and iPhone/Safari on the preview: emulation cannot fully reproduce mobile keyboards, browser chrome, OS text scaling or touch scrolling.

## Remaining production work

- Consider Vercel firewall and bot protection for `/api/search` if abuse appears. App-layer limits are not DDoS protection, authentication or a complete bot defense. Cross-site origin checks do not prevent direct scripts/curl.
- Set provider-side spend controls/billing alerts and monitor 429/503/502 rates and latency. Decide whether to add shared quotas or challenges after observed abuse.
- Review previews so untrusted contributors cannot access production secrets. Avoid testing CI with real TypeSafe credentials.
- Keep dependencies patched and review audit alerts; an empty advisory report does not prove absence of vulnerabilities. Strict CSP and broader accessibility/manual device testing remain separate follow-ups.

Reference: [Vercel request headers](https://vercel.com/docs/headers/request-headers).
