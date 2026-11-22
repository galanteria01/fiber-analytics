# Deployment

> Vercel for the dashboard + any container host for the worker, or a full local MinIO stack for development.

## Architecture recap

See [Architecture](architecture.md) for the full data-flow diagram. In deployment terms:

- **Dashboard + ingestion edge** — `apps/dashboard` (Next.js). Stateless except for the object store.
- **Sync worker** — `apps/worker` (Node.js service). Owns all Parquet writes, compaction, and retention pruning.
- **Object store** — `packages/storage` adapters (`local` for dev, `s3` for prod via AWS S3 or MinIO).

Both services share one env contract (`.env.example`) and can scale independently once `FA_STORAGE=s3`.

## Vercel (dashboard) + a worker host

### Dashboard on Vercel

`apps/dashboard/vercel.json` sets the monorepo build/install commands so no extra Vercel project settings are needed:

```json
{
  "buildCommand": "cd ../.. && pnpm build:packages && pnpm --filter dashboard build",
  "installCommand": "cd ../.. && pnpm install --frozen-lockfile",
  "functions": { "app/api/ingest/route.ts": { "maxDuration": 10 } }
}
```

1. Import `apps/dashboard` as the Vercel project root.
2. In the Vercel project settings add the env vars (see checklist below) — at minimum `FA_STORAGE=s3`, the `FA_S3_*` bucket credentials, and (for production) `FA_DASHBOARD_PASSWORD` + `FA_AUTH_SECRET`.
3. Deploy. The dashboard's DuckDB connection lazily opens on first request and uses `httpfs` against the configured S3 bucket.

### Worker on any host

The worker can run anywhere that can reach the same bucket (ECS, Fly, a VM, a cron box). It owns claim -> compile -> compact -> prune.

Build and run:

```bash
docker build -f apps/worker/Dockerfile -t fiber-analytics-worker .
docker run --env-file .env fiber-analytics-worker
```

Or as a one-shot (e.g. a scheduled job):

```bash
pnpm sync   # runs apps/worker --once
```

The worker image is stateless besides the configured object store; it can be replicated only when the underlying store provides atomic claim semantics (S3 `CopyObject`+`DeleteObject` in `packages/storage/src/s3.ts`).

## Full local cloud-like stack (MinIO + dashboard + worker)

For a realistic S3-backed flow without touching AWS:

```bash
cp .env.example .env        # root, read by docker compose
docker compose up --build
```

This starts:

| Service        | Port                          | Description                                                        |
| -------------- | ----------------------------- | ------------------------------------------------------------------ |
| `minio`        | `9000` (S3), `9001` (console) | MinIO with healthcheck-gated readiness.                            |
| `createbucket` | —                             | One-shot `mc` job that creates `${FA_S3_BUCKET:-fiber-analytics}`. |
| `dashboard`    | `3000`                        | Next.js dashboard + ingestion edge over MinIO (`FA_STORAGE=s3`).   |
| `worker`       | —                             | Polling worker over the same bucket.                               |

The dashboard and worker are wired to `FA_STORAGE=s3` with `FA_S3_ENDPOINT=http://minio:9000` and `FA_S3_FORCE_PATH_STYLE=true` (see `docker-compose.yml` and the `FA_S3_*` vars below). MinIO credentials default to `minioadmin` / `minioadmin` and the demo MinIO console is at http://localhost:9001.

## Environment variable checklist

All variables are optional for local development (see [`.env.example`](../.env.example) for annotated defaults). For production the highlighted rows should be set.

### Storage

| Variable                  | Default     | Production guidance                                         |
| ------------------------- | ----------- | ----------------------------------------------------------- |
| `FA_STORAGE`              | `local`     | Set to `s3` in production / docker-compose.                 |
| `FA_DATA_DIR`             | `./data`    | Local adapter root (ignored when `FA_STORAGE=s3`).          |
| `FA_S3_BUCKET`            | _(none)_    | **Required when `FA_STORAGE=s3`.**                          |
| `FA_S3_REGION`            | `us-east-1` | Match your bucket's region.                                 |
| `FA_S3_ENDPOINT`          | _(none)_    | Required for MinIO; omit for AWS S3.                        |
| `FA_S3_ACCESS_KEY_ID`     | _(none)_    | **Required for S3.**                                        |
| `FA_S3_SECRET_ACCESS_KEY` | _(none)_    | **Required for S3.**                                        |
| `FA_S3_FORCE_PATH_STYLE`  | `false`     | Set to `true` for MinIO.                                    |
| `FA_S3_PREFIX`            | _(none)_    | Optional `s3://bucket/<prefix>/` prefix for shared buckets. |

### Ingestion edge (`apps/dashboard`)

| Variable             | Default                      | Production guidance                                                     |
| -------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| `FA_ALLOWED_ORIGINS` | _(allow all)_                | **Restrict to your origins** (CSV, e.g. `https://app.example.com`).     |
| `FA_ALLOWED_DOMAINS` | _(allow all)_                | **Restrict to your domains** (CSV, e.g. `app.example.com`).             |
| `FA_MAX_BODY_BYTES`  | `262144`                     | Tune per workload.                                                      |
| `FA_MAX_EVENTS`      | `500`                        | Max events per ingest request (enforced via `validateIngestPayload`).   |
| `FA_RATE_LIMIT_RPM`  | `600`                        | Per-IP rate limit per minute.                                           |
| `FA_IP_HEADER`       | `x-forwarded-for`            | Header to read the client IP from (adjust for your proxy/CDN).          |
| `FA_DAILY_SECRET`    | `fiber-analytics-dev-secret` | **Change to a strong random value** — controls `session_hash` rotation. |
| `FA_RETENTION_DAYS`  | `90`                         | Must match the worker's value.                                          |

### Dashboard auth

| Variable                | Default                           | Production guidance                                                                                     |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `FA_DASHBOARD_USER`     | `admin`                           | Custom login username.                                                                                  |
| `FA_DASHBOARD_PASSWORD` | _(auth disabled)_                 | **Set to enable auth.** When unset, `authDisabled()` returns `true` and the dashboard is public.        |
| `FA_AUTH_SECRET`        | `fiber-analytics-dev-auth-secret` | **Set to a strong random value when `FA_DASHBOARD_PASSWORD` is set** — used to sign the session cookie. |
| `FA_AUTH_DISABLED`      | `false`                           | When `true`, disables auth entirely (overrides `FA_DASHBOARD_PASSWORD`). Never enable in production.    |

### Worker

| Variable                  | Default | Description                                                      |
| ------------------------- | ------- | ---------------------------------------------------------------- |
| `FA_WORKER_INTERVAL_MS`   | `4000`  | Poll interval for the long-lived worker loop.                    |
| `FA_COMPACTION_THRESHOLD` | `8`     | Merge a partition when it accumulates more than this many files. |
| `FA_RETENTION_DAYS`       | `90`    | Prune partitions older than this.                                |

### Demo app (`apps/demo`)

| Variable           | Default                            | Description                          |
| ------------------ | ---------------------------------- | ------------------------------------ |
| `VITE_FA_ENDPOINT` | `http://localhost:3000/api/ingest` | Ingestion URL the demo SDK posts to. |

### Logging

| Variable       | Default | Description        |
| -------------- | ------- | ------------------ |
| `FA_LOG_LEVEL` | `info`  | Log level: `debug` | `info` | `warn` | `error`. |

## Related docs

- [Production checklist](production-checklist.md) — hardening checklist before going live.
- [Privacy](privacy.md) — secrets, IP truncation, retention.
- [Troubleshooting](troubleshooting.md) — common issues and fixes.
