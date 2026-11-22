# Troubleshooting

> Common issues and how to fix them.

## Empty analytics globs (dashboard shows no data)

**Symptom:** The dashboard renders an empty state — no sessions, no timelines, no path analysis.

**Cause:** DuckDB's `read_parquet(glob)` throws when the glob matches zero files. This is expected before any events have been flushed and is handled gracefully by `apps/dashboard/lib/duckdb.ts:hasData()`.

```ts
export async function hasData(): Promise<boolean> {
  try {
    // probe the glob via a lightweight query
  } catch {
    return false; // empty store — not an error
  }
}
```

Dashboard pages guard with `hasData()` before issuing analytics queries, so the empty store produces an empty state instead of a `500`. See also [Architecture — Object-store layout](architecture.md).

**Fix:**

1. Confirm the ingestion edge received events — check the browser Network tab for `POST /api/ingest` with `204`.
2. Confirm raw files exist — list `data/raw/*.ndjson` (local) or `s3://<bucket>/raw/` (S3).
3. Flush them into Parquet:

   ```bash
   pnpm sync
   ```

   You should see `synced { files: N }`. If you see `nothing to sync`, no raw files were present — go back to step 1.

4. Confirm Parquet exists — `data/analytics/**.parquet` (or `s3://<bucket>/analytics/`) and that `GET /api/health` returns `200` with `hasData: true`.

## `pnpm` fails with `value.replace is not a function`

**Symptom:**

```
TypeError: value.replace is not a function
```

**Cause:** Your global `~/.npmrc` contains a **registry-scoped** CA entry written with array syntax, e.g.:

```
 //your-registry/:ca[]=${CERT1}
```

pnpm performs an env-substitution pass that calls `.replace()` on each value. For a scoped `…/:ca[]=` key the value is an array, so it throws. (Global `ca[]=` PEM lines are fine — only the scoped `:ca[]=` form breaks.) See [README — Troubleshooting](../README.md#troubleshooting).

**Permanent fix** — remove just those scoped lines (a backup is cheap):

```bash
cp ~/.npmrc ~/.npmrc.bak
sed -i '' '/:ca\[\]=/d' ~/.npmrc   # macOS
# or
sed -i '/:ca\[\]=/d' ~/.npmrc      # Linux
```

If you genuinely need a per-registry CA, use a file reference instead of the inline array:

```
 //your-registry/:cafile=/absolute/path/to/ca.pem
```

**Temporary, non-invasive alternative** — bypass your global config for one command (also bypasses its auth):

```bash
printf 'registry=https://registry.npmjs.org/\n' > /tmp/clean.npmrc
npm_config_userconfig=/tmp/clean.npmrc pnpm install
```

## Ingest returns `429` or `403`

- **`429 rate limited`** — the per-IP fixed-window limiter (`apps/dashboard/lib/ratelimit.ts`, `FA_RATE_LIMIT_RPM` per minute) was exceeded. Confirm your proxy's IP header is correctly configured (`FA_IP_HEADER`, default `x-forwarded-for`) so distinct clients are not bucketed under one IP, and tune `FA_RATE_LIMIT_RPM` for your traffic.
- **`403 origin not allowed` / `403 domain not allowed`** — the request's `Origin` or payload's `domain` was not in the configured allowlists. Verify `FA_ALLOWED_ORIGINS` / `FA_ALLOWED_DOMAINS` match the SDK's `init({ domain })` value and the page origin exactly (CSV, no wildcards). Empty allowlists mean "allow all" and are only appropriate for local development.

## Auth / login issues

- **Redirect loop to `/login`** — auth is enabled (`FA_DASHBOARD_PASSWORD` is set) and the `fa_session` cookie is missing or expired. Log in again; the cookie is `sameSite: 'strict'` and `httpOnly`.
- **`FA_AUTH_SECRET` must not be the default in production** — when `FA_DASHBOARD_PASSWORD` is set and `FA_AUTH_SECRET` is unset or equal to `fiber-analytics-dev-auth-secret`, startup is rejected in production. Set both to strong random values; see [Production checklist](production-checklist.md).
- **Bypassed auth in development** — when `FA_DASHBOARD_PASSWORD` is unset (or `FA_AUTH_DISABLED=true`), `authDisabled()` returns `true` and the middleware passes all requests through. This is intentional; do not use it in production.

## Related docs

- [Quickstart](quickstart.md) — local end-to-end flow.
- [Deployment](deployment.md) — env checklist and S3/MinIO setup.
- [Production checklist](production-checklist.md) — hardening before going live.
