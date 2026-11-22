# Quickstart

> From first install to a populated dashboard in under five minutes.

## Prerequisites

- Node.js >= 20 and pnpm >= 10 (`corepack enable` or `npm i -g pnpm`).
- No other services required for the local flow — the default store is the local filesystem.

## 1. Install and build

```bash
pnpm install
pnpm build:packages   # builds core, storage, compiler, browser SDK
```

All configuration is via environment variables; see [`.env.example`](../.env.example) for the full list. For local development every variable is optional — the defaults give a working local-first setup.

If you want to customize anything for `pnpm dev`, copy `.env.example` to `apps/dashboard/.env.local`:

```bash
cp .env.example apps/dashboard/.env.local
```

Key knobs (all optional locally):

```bash
FA_STORAGE=local                 # local (default) | s3
FA_DAILY_SECRET=change-me        # session-hash secret (rotate per deploy)
FA_DASHBOARD_PASSWORD=change-me  # enables dashboard auth when set
```

## 2. Start the demo and the dashboard together

```bash
pnpm dev
```

This uses `concurrently` to run:

- **Demo app** at http://localhost:5173 — a Vite + React app with buttons, a form, a modal, and client-side routing.
- **Dashboard** at http://localhost:3000 — the Next.js ingestion edge + analytics UI.

## 3. Generate events

Open http://localhost:5173 and interact with the page:

- Click the buttons.
- Fill out and submit the form.
- Open and close the modal.
- Navigate between routes.

### Expected console output

On localhost with `debug: true` (the demo's default), the SDK renders a small fixed-position **overlay** in the bottom-right corner titled "FiberAnalytics - captured events". Each interaction appends a colored row (green for `click`, pink for `submit`, etc.) with the component name and event type. No manual `track()` call is needed — every interactive element is already tagged at build time by the compiler.

### Expected network output

Open the browser **Network** tab and look for `POST http://localhost:3000/api/ingest`:

- Requests fire during idle time (`requestIdleCallback`, ~2 s timeout) or immediately when the batch reaches `maxBatchSize` (default 25).
- Leaving or hiding the page flushes via `navigator.sendBeacon` (chunked to ~60 KB per chunk).
- Successful responses are `204 No Content` with no body — ingestion is intentionally body-less for speed and `sendBeacon` compatibility.
- Payload shape: `{ domain: "app.com", events: [ …ClientEvent ] }`.

## 4. Flush buffered events into Parquet

The ingestion edge writes NDJSON files under `data/raw/` (or `s3://…/raw/` when `FA_STORAGE=s3`). The dashboard only queries compiled Parquet, so flush them:

```bash
pnpm sync
```

This runs the worker once (`apps/worker --once`): it claims `raw/*.ndjson` into `processing/`, deduplicates by `event_id`, and writes hive-partitioned Parquet under `data/analytics/` (or the S3 prefix). You should see log lines like `synced { files: N }`.

If there was nothing to flush you will see `nothing to sync` — that is normal on the first run before any events have been generated.

## 5. Open the dashboard

Open http://localhost:3000:

- **Overview** — top components, event-type breakdown, funnel.
- **Sessions** (`/sessions`) — list of cookieless sessions.
- **Session timeline** (`/sessions/[id]`) — ordered journey for a single session.
- **Path analysis** (`/paths`) — common navigation paths.
- **Filter bar** — slice by date range, domain, event type, component, or URL.

If no Parquet exists yet the dashboard renders an empty state gracefully (see [Troubleshooting](troubleshooting.md)).

## 6. Running the worker continuously (optional)

To keep Parquet fresh without manually running `pnpm sync`:

```bash
pnpm worker
```

The worker polls every `FA_WORKER_INTERVAL_MS` (default 4000 ms), compiles new raw files, compacts small partitions, and prunes partitions older than `FA_RETENTION_DAYS`.

## Next steps

- [Compiler — Vite](integration-vite.md) — adapter options, `includeSourceLocation`, denylist, `data-fa-ignore`.
- [Compiler — Next.js](integration-nextjs.md) — Next.js variant.
- [Browser SDK](integration-react.md) — `init` signature, consent, manual `track`/`page`, teardown.
- [Privacy](privacy.md) — session model, IP truncation, DNT/GPC, redaction, retention.
- [Deployment](deployment.md) — Vercel + worker host, MinIO local stack.
- [Troubleshooting](troubleshooting.md) — common issues and fixes.
