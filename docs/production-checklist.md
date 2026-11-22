# Production checklist

> Audit this list before exposing the dashboard or ingestion edge to production traffic.

Read [Deployment](deployment.md) for how to configure these values on Vercel or in `docker-compose.yml`, and [Privacy](privacy.md) for the underlying guarantees.

## Allowlists

- [ ] `FA_ALLOWED_ORIGINS` — set to your real origin(s) (CSV, e.g. `https://app.example.com,https://admin.example.com`). When nonempty the ingest route returns `403` for any other `Origin`; see `apps/dashboard/app/api/ingest/route.ts` and `apps/dashboard/lib/config.ts:isAllowed`.
- [ ] `FA_ALLOWED_DOMAINS` — set to your real domain(s) (CSV, e.g. `app.example.com`). When nonempty the ingest route verifies the payload's `domain` field and returns `403` otherwise. Keep this in sync with the `domain` passed to the SDK's `init({ domain })`.
- [ ] `FA_IP_HEADER` — confirm it matches your proxy/CDN's IP-forwarding header. The default is `x-forwarded-for`; CDNs that use a different header (e.g. `cf-connecting-ip`) must be adjusted so per-IP rate limiting and `session_hash` derivation use the real client IP. See `apps/dashboard/lib/config.ts:getConfig` and `apps/dashboard/app/api/ingest/route.ts:clientIp`.

## Secrets

- [ ] `FA_DAILY_SECRET` — change from the default `fiber-analytics-dev-secret` to a strong random value. This seeds the UTC-day-scoped `session_hash` (`apps/dashboard/lib/session.ts:sessionHash`). Rotate on deploy; see [Privacy — daily secret rotation](privacy.md).
- [ ] `FA_DASHBOARD_PASSWORD` — set to a strong password to enable dashboard auth. When unset the dashboard is publicly accessible (`authDisabled()` in `apps/dashboard/lib/auth.ts` returns `true`).
- [ ] `FA_AUTH_SECRET` — set to a strong random value whenever `FA_DASHBOARD_PASSWORD` is set. This signs the `fa_session` cookie (`apps/dashboard/lib/auth.ts:secret` / `sign`). In production, `FA_DASHBOARD_PASSWORD` without `FA_AUTH_SECRET` (or with the default `fiber-analytics-dev-auth-secret`) is rejected at startup.
- [ ] `FA_AUTH_DISABLED` — ensure this is `false` or unset in production. `true` bypasses all dashboard auth even when a password is configured.

## Retention, compaction, and storage

- [ ] `FA_RETENTION_DAYS` — confirm the dashboard and worker agree (they read the same env var, but separate deploys must be kept in sync). Default `90`; see `apps/worker/src/pipeline.ts:prune`.
- [ ] `FA_STORAGE=s3` — use `s3` in production so the edge (stateless/serverless) and the worker share the same bucket via `packages/storage`'s S3 adapter. Local storage cannot be shared across instances.
- [ ] `FA_S3_BUCKET`, `FA_S3_REGION`, `FA_S3_ACCESS_KEY_ID`, `FA_S3_SECRET_ACCESS_KEY` — verified and scoped to least privilege (the service needs only `PutObject`/`GetObject`/`ListObjects`/`CopyObject`/`DeleteObject` on its prefix).
- [ ] `FA_S3_PREFIX` — set when sharing a bucket with other workloads to isolate `raw/`, `processing/`, and `analytics/` keys.
- [ ] `FA_WORKER_INTERVAL_MS` / `FA_COMPACTION_THRESHOLD` — reviewed for your traffic volume. Defaults are `4000` ms / `8` files per partition; see `apps/worker/src/config.ts`.

## Rate limiting, body caps, and content-type

- [ ] `FA_MAX_BODY_BYTES` (default `256 KiB`) and `FA_MAX_EVENTS` (default `500`) — tuned for your expected batch sizes; enforced via `validateIngestPayload(events, maxEvents)` and the ingest route's declared/actual size checks.
- [ ] `FA_RATE_LIMIT_RPM` (default `600`) — per-IP fixed-window limit in `apps/dashboard/lib/ratelimit.ts`. The ingest route returns `429` when exceeded.
- [ ] The ingest route rejects requests whose `Content-Type` is not `application/json` with `415` (with `Access-Control-Allow-Headers: content-type` for CORS preflight).

## CORS

- [ ] The ingest route (`apps/dashboard/app/api/ingest/route.ts:corsHeaders`) echoes the request `Origin` only when it is in `FA_ALLOWED_ORIGINS`; otherwise it returns `Access-Control-Allow-Origin: null`. `Vary: Origin` is set so CDNs do not cache the wrong header.
- [ ] Preflight is handled via an explicit `OPTIONS` handler that returns `204` with the same CORS headers.
- [ ] Ingestion is the only cross-origin endpoint. Dashboard pages and the health check are same-origin.

## Health checks

- [ ] `GET /api/health` — returns `{ ok, storage, hasData, version, time }` and reports `503` when the object store is unreachable. Use it as the liveness/readiness probe for your dashboard deployment (`apps/dashboard/app/api/health/route.ts` reads `getStore().kind` and `hasData()` from `apps/dashboard/lib/duckdb.ts`).
- [ ] Dashboard `Dockerfile` healthcheck — `node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`.
- [ ] Worker `FA_WORKER_HEALTH_PORT` — when set, `apps/worker/src/index.ts` starts a tiny HTTP server exposing `/health` with the last run timestamp and last error. Default is disabled (liveness is process-based).

## Security headers and cookies

- [ ] `next.config.mjs:headers()` — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and a conservative `Content-Security-Policy` compatible with Next.js hydration and inline styles.
- [ ] Auth cookie — `apps/dashboard/app/api/auth/login/route.ts` sets `sameSite: 'strict'` (and `httpOnly`, `secure` in production).

## Dashboard access

- [ ] Auth is enabled (`FA_DASHBOARD_PASSWORD` set) and `FA_AUTH_SECRET` is a strong random value.
- [ ] The `fa_session` cookie is HMAC-SHA256-signed with expiry; `apps/dashboard/lib/auth.ts:verifyToken` validates signature and ttl.
- [ ] The middleware (`apps/dashboard/middleware.ts`) gates all pages except `api/*`, `_next/*`, `login`, and `favicon.ico`.
- [ ] Rate limiting bounds ingest abuse even from unauthenticated origins.

## Final verification

- [ ] `pnpm install`, `pnpm build:packages`, `pnpm build` succeed.
- [ ] `pnpm test` passes (including ingest route, storage, and worker pipeline tests).
- [ ] `docker compose up --build` starts MinIO + dashboard + worker locally; `POST /api/ingest` returns `204`, `GET /api/health` returns `200` with `hasData: true` after `pnpm sync`, and the dashboard renders sessions/timelines.
- [ ] Docs links in the README and within `docs/` resolve (e.g. `docs/architecture.md` -> `docs/privacy.md`).
