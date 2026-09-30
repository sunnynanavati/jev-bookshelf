<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Version-control workflow

The user has authorized committing completed project changes locally and pushing them to this repository's configured GitHub remote as part of ongoing implementation work.

- Inspect Git status before editing; preserve unrelated user changes and never include them without authorization.
- Make small, focused commits after each completed, verified feature or fix. Use descriptive Conventional Commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Run relevant tests and TypeScript checks before committing code; run a production build for substantial changes. Report failed or unavailable checks honestly.
- Review staged changes and check for secrets before committing. Never track credentials, `.env.local`, dependencies, caches, build output, or TypeScript build-info files. Keep `.env.example` credential-free.
- Push completed commits to the current branch's configured origin and report the commit hash and push outcome. If pushing fails, retain the local commit and explain the blocker.
- For larger changes, prefer a short-lived `codex/` branch and a pull request; do not merge without user approval. Never force-push, rewrite published history, or discard local work without explicit authorization.
- Questions, diagnosis, and review alone do not authorize unrelated code changes or commits.
