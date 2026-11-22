# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 0.1.x   | Yes       |
| < 0.1   | No        |

Only the latest `main` and the most recent tagged release receive security fixes. Older versions may be supported on a best-effort basis — open an issue to ask.

## Reporting a vulnerability

If you discover a security vulnerability, please report it privately so we can fix it before public disclosure.

1. **Email:** security@fiber-analytics (placeholder — use a private security advisory if email is not yet configured).
2. **GitHub Security Advisories:** open a draft advisory at `https://github.com/galanteria01/fiber-analytics/security/advisories/new`.

Include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Any suggested fix or mitigation.

We will acknowledge receipt within 2 business days and aim to provide a fix or mitigation plan within 14 days. Please do not disclose the issue publicly until a fix has been released and we have coordinated disclosure.

## What to report

- Authentication bypass, session/token issues, or privilege escalation in the dashboard.
- Injection, XSS, or SSRF via the ingest pipeline or dashboard queries.
- Sensitive data exposure (PII, credentials, secrets) in logs, storage, or responses.
- Dependency vulnerabilities with a plausible exploit path in this project.

Out of scope: theoretical issues without a reproduction, social engineering, or vulnerabilities in third-party hosting infrastructure (e.g. Vercel, S3) that do not affect this codebase.

## Security headers and hardening

The dashboard ships with `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, and a conservative `Content-Security-Policy` (see `apps/dashboard/next.config.mjs`). The ingest route enforces origin/Domain allowlists, bot filtering, rate limiting, and body-size caps. See `docs/production-checklist.md` for the full hardening checklist.
