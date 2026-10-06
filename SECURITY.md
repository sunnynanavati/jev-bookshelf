# Security policy

## Supported versions

Security fixes target the latest code on `main`. Older commits and forks do not
receive backported fixes. This is a hobby project with no guaranteed response
time or security service-level agreement.

## Reporting a vulnerability

Please use [GitHub's private vulnerability reporting](https://github.com/sunnynanavati/jev-bookshelf/security/advisories/new)
to report suspected vulnerabilities privately to the repository maintainer.
You can also find **Report a vulnerability** in this repository's **Security** tab.

Do not open a public issue or pull request containing vulnerability details,
credentials, or an exploit before the maintainer has had a chance to review the
report. Ordinary bugs and feature requests can use public issues.

Include the affected commit or deployment, steps to reproduce, expected and
observed behavior, and the potential impact. Share a minimal proof of concept
where possible, with secrets and personal data removed. Never include a real
API key in a report.

Please coordinate public disclosure with the maintainer while a fix is being
prepared. Reports are reviewed on a best-effort basis; no bug bounty is offered.

## Safe testing

Prefer a local instance and your own test credentials. Do not run load tests,
exhaust paid API credits, access other people's data, or perform destructive
testing against the hosted demo. Do not test TypeSafe, Open Library, GitHub,
Vercel, or other third-party services through this project; their own policies
apply.

## Deployment considerations

- Keep `TYPESAFE_API_KEY` server-side and out of commits, browser bundles, logs,
  and public reports. `.env.local` is ignored by Git.
- The in-memory search quotas are best-effort per server instance, not a durable
  global spending cap. Configure provider-side spending controls where available.
- Fork maintainers are responsible for their own credentials, dependency
  updates, deployment settings, and security response.

See [production safeguards](docs/production-safeguards.md) for the current
protections and their limitations.
