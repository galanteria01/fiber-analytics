# FiberAnalytics

[![CI](https://github.com/galanteria01/fiber-analytics/actions/workflows/ci.yml/badge.svg)](https://github.com/galanteria01/fiber-analytics/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![npm version](https://img.shields.io/npm/v/@fiber-analytics/core)](https://www.npmjs.com/search?q=%40fiber-analytics)

> **Problem:** Manual UI instrumentation is brittle and expensive — every analytics event requires hand-written code that drifts from the components it measures. Generic page analytics loses per-component meaning, and cookie-based session stitching conflicts with privacy expectations.

> **Solution:** FiberAnalytics auto-tags interactive JSX at build time, captures semantic component context with a tiny non-blocking browser SDK, and stores it as columnar Parquet queried in-process by DuckDB — no always-on database, no cookies, no PII.

> **You should use this if:** you build React apps (Vite, Next.js, or any Babel/webpack/Rollup/esbuild toolchain), want component-level analytics without manual `track()` calls, and prefer a privacy-first, local-first stack you can run on your own infrastructure.

## Why FiberAnalytics

| Concern            | Manual instrumentation       | Generic page analytics            | **FiberAnalytics**                                                      |
| ------------------ | ---------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| Component identity | Hand-coded string, drifts    | Not tracked                       | Auto-tagged at build (`data-fa-comp` + props + source location)         |
| Prop capture       | Per-call, ad hoc             | None                              | Safelisted primitive props, sensitive keys redacted at build + ingest   |
| Session model      | Cookies / cross-site ID      | Cookie banner required            | Cookieless `sessionStorage` + 30-min sliding window                     |
| Privacy            | Depends on discipline        | Third-party scripts, fingerprints | IP truncated (/24 / /48), daily secret rotation, DNT/GPC + consent gate |
| Storage            | App's OLTP DB / vendor cloud | Vendor warehouse                  | Local filesystem or S3 + hive-partitioned Parquet                       |
| Query cost         | DB load, ORM, migrations     | Vendor pricing                    | In-process DuckDB `read_parquet` — no always-on server                  |
| Data ownership     | Mixed                        | Vendor-locked                     | You own the Parquet files                                               |

## Architecture

```mermaid
flowchart TD
  Build["Compiler (build): data-fa-comp / props / loc"] --> App["Instrumented app"]
  App --> SDK["Browser SDK: sessions, pageviews, queue, retry, consent"]
  SDK -->|"POST JSON (idle / beacon, chunked)"| Ingest["/api/ingest (validate, allowlist, rate-limit, enrich, clamp)"]
  Ingest -->|"PutObject NDJSON"| Raw["ObjectStore raw/ (S3 or local)"]
  Raw --> Worker["Sync + compaction worker"]
  Worker -->|"dedup -> Parquet, compact, prune"| Analytics["ObjectStore analytics/**.parquet"]
  Analytics -->|"read_parquet via httpfs"| DuckDB["DuckDB in-process"]
  DuckDB --> Dash["Next.js dashboard (auth): filters, sessions, trace, paths"]
```

| Module           | Package                        | Role                                                                                                      |
| ---------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| Compiler         | `@fiber-analytics/compiler`    | Babel AST transform that auto-tags interactive JSX with `data-fa-comp` / `data-fa-props` / `data-fa-loc` (adapters: Vite, webpack/Next.js, Rollup, esbuild, Astro, Babel). |
| Client SDK       | `@fiber-analytics/browser`     | Delegated event tracker with sessions, SPA pageviews, consent, and a retrying/chunked transport.          |
| Shared core      | `@fiber-analytics/core`        | Versioned event schema, validation, prop safelist + denylist, shared types.                               |
| Object storage   | `@fiber-analytics/storage`     | `ObjectStore` abstraction with local-filesystem and S3/MinIO adapters.                                    |
| Demo app         | `apps/demo`                    | Vite + React app exercising clicks, forms, modals, and client-side routing.                               |
| Edge + dashboard | `apps/dashboard`               | Hardened Next.js ingestion route + authenticated analytics & tracing UI.                                  |
| Sync worker      | `apps/worker`                  | Standalone service: raw NDJSON → deduped Parquet, compaction, retention pruning.                          |

See [docs/architecture.md](docs/architecture.md) for module boundaries, data flow, and ownership.

## Prerequisites

- Node.js >= 20 (tested on 20 and 22)
- pnpm >= 10 (`corepack enable` or `npm i -g pnpm`)

## Quickstart

```bash
pnpm install
pnpm build:packages        # build core, storage, compiler, browser SDK
pnpm dev                   # runs demo (5173) + dashboard (3000) together
```

Then:

1. Open the demo at http://localhost:5173 and click around (buttons, the form, open/close the modal). The on-screen overlay shows captured events live.
2. Flush buffered raw events into Parquet partitions:

   ```bash
   pnpm sync
   ```

Full walkthrough: [docs/quickstart.md](docs/quickstart.md) • Integration: [Compiler (Vite)](docs/integration-vite.md) • [Compiler (Next.js)](docs/integration-nextjs.md) • [Browser SDK](docs/integration-react.md) • [Privacy](docs/privacy.md) • [Deployment](docs/deployment.md) • [Production checklist](docs/production-checklist.md) • [Why FiberAnalytics](docs/positioning.md)
### Environment

All configuration is via environment variables; see [`.env.example`](.env.example) for the full list with defaults. Everything is optional for local dev. The most common knobs:

```bash
FA_STORAGE=local                 # local (default) | s3
FA_DAILY_SECRET=change-me        # session-hash secret (rotate per deploy)
FA_DASHBOARD_PASSWORD=change-me  # enables dashboard auth when set
```

Copy `.env.example` to `apps/dashboard/.env.local` (for `pnpm dev`) or to `.env` (for docker-compose).

## Deployment

### Full local cloud-like stack (MinIO + worker + dashboard)

```bash
cp .env.example .env
docker compose up --build
```

This starts MinIO (S3, console at http://localhost:9001), the dashboard + ingestion edge (http://localhost:3000), and the sync worker — all wired to `FA_STORAGE=s3`.

### Vercel (dashboard) + a worker host

- Deploy `apps/dashboard` to Vercel; [`apps/dashboard/vercel.json`](apps/dashboard/vercel.json) sets the monorepo build/install commands. Configure `FA_STORAGE=s3` and the `FA_S3_*` / auth / secret env vars in the project settings.
- Run the worker anywhere that can reach the same bucket (container host, ECS, a cron box) using [`apps/worker/Dockerfile`](apps/worker/Dockerfile). It owns all Parquet compaction and retention pruning.

See [docs/deployment.md](docs/deployment.md) for the full checklist.

### CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint + typecheck + build + test on every push and PR.

## Code quality

The codebase follows the `vercel-react-best-practices` rules where they apply:

- **Browser SDK** — init-once listeners, a single delegated `click`/`change` listener, passive listeners, idle-time flushing, `Set`/`Map` lookups and early exits, and a transient queue held in module state rather than React state.
- **Dashboard** — async Server Components, parallel DuckDB queries via `Promise.all`, per-request dedup with `React.cache()`, a module-hoisted DuckDB connection, `<Suspense>` streaming per panel, and `recharts` lazy-loaded via `next/dynamic`.
- **Compiler** — hoisted matchers, early exits on non-interactive nodes, and idempotent transforms.
- **Architecture** — one responsibility per file, a single `src/index.ts` entry per package, shared types only in `@fiber-analytics/core`, and strict TypeScript across the workspace.

## Data schema (v2)

Each telemetry record is normalized into a columnar-friendly shape. `schema_version` lets old and new Parquet coexist (`union_by_name`) during rollout.

| Column                     | Type      | Description                                                                |
| -------------------------- | --------- | -------------------------------------------------------------------------- |
| `event_id`                 | UUID      | Unique id for the record (used for dedup).                                 |
| `schema_version`           | INT       | Event schema version.                                                      |
| `session_id`               | VARCHAR   | Primary journey key — ephemeral, cookieless, client-minted.                |
| `pageview_id`              | VARCHAR   | Identifies a single page view within a session.                            |
| `seq`                      | BIGINT    | Monotonic per-session ordering counter.                                    |
| `session_hash`             | VARCHAR   | Secondary server-side correlation key (bot/cross-check).                   |
| `timestamp`                | TIMESTAMP | Server-authoritative receive time (clamped).                               |
| `occurred_at`              | TIMESTAMP | Client event time.                                                         |
| `event_type`               | VARCHAR   | `click`, `view`, `page_view`, `submit`, `input`, `state_change`, `custom`. |
| `event_name`               | VARCHAR   | Optional name for custom/manual events.                                    |
| `component_name`           | VARCHAR   | Extracted UI component identifier.                                         |
| `properties`               | JSON      | Safelisted primitive props / metadata (sensitive keys redacted).           |
| `url_path`                 | VARCHAR   | Path where the action occurred.                                            |
| `referrer`, `page_title`   | VARCHAR   | Page context.                                                              |
| `viewport_w`, `viewport_h` | INT       | Viewport dimensions.                                                       |
| `locale`, `device`         | VARCHAR   | Locale and device class hint.                                              |
| `utm_*`                    | VARCHAR   | Optional campaign parameters.                                              |
| `source_loc`               | VARCHAR   | `file:line:col` of the component (trace-to-source).                        |

`@fiber-analytics/core` is the single source of truth for this schema — see [`packages/core/src/schema.ts`](packages/core/src/schema.ts) and [docs/architecture.md](docs/architecture.md).

## Privacy

Journeys are keyed on a **client `session_id`**: an ephemeral, cookieless id held in `sessionStorage` with a 30-minute sliding inactivity window — no cross-site identifier and no PII. A server-derived `session_hash` is kept only as a secondary correlation/bot-check signal:

```
session_hash = sha256(userAgent + truncatedIP + dailySecret)
```

IPv4 is truncated to /24 and IPv6 to /48, and the secret rotates per UTC day — so it cannot be correlated across days. The SDK honours **DNT/GPC** and an explicit consent gate, sensitive property keys are redacted at both build and ingest time, and the worker **prunes** partitions older than `FA_RETENTION_DAYS`.

Details: [docs/privacy.md](docs/privacy.md)

## Scripts

| Command                     | Description                                                              |
| --------------------------- | ------------------------------------------------------------------------ |
| `pnpm build:packages`       | Build the shared packages (`core`, `storage`, `compiler`, `browser`).    |
| `pnpm dev`                  | Run demo + dashboard concurrently.                                       |
| `pnpm sync`                 | Run the worker once: compile raw NDJSON into Parquet partitions.         |
| `pnpm worker`               | Run the worker as a long-lived service (poll + compact + prune).         |
| `pnpm build`                | Build packages + dashboard for production.                               |
| `pnpm test`                 | Run all workspace tests (Vitest).                                        |
| `pnpm lint` / `pnpm format` | Lint / format the workspace.                                             |

## Docs

- [Architecture](docs/architecture.md) — module boundaries, data flow, ownership
- [Quickstart](docs/quickstart.md) — install → first event → sync → dashboard
- [Compiler — Vite](docs/integration-vite.md) — Vite adapter, plugin options, denylist, ignore attribute
- [Compiler — Next.js](docs/integration-nextjs.md) — Next.js adapter (Babel vs webpack hook)
- [Browser SDK](docs/integration-react.md) — init, consent, manual track/page, teardown
- [Privacy](docs/privacy.md) — session id, IP truncation, DNT/GPC, redaction, retention
- [Deployment](docs/deployment.md) — Vercel + worker, MinIO, env checklist
- [Production checklist](docs/production-checklist.md) — allowlists, secrets, retention, auth, CORS, health
- [Positioning](docs/positioning.md) — elevator pitch, personas, comparison vs alternatives
- [Troubleshooting](docs/troubleshooting.md) — common issues and fixes
- [Demo script](docs/demo-script.md) — 2-minute walkthrough for demos and recordings
- [Assets](docs/assets/README.md) — how to capture screenshots/GIFs for README and npm pages

## Troubleshooting

### `pnpm` fails with `value.replace is not a function`

This is caused by your global `~/.npmrc`, not by this project. pnpm cannot parse a **registry-scoped** CA entry written with array syntax, e.g.:

```
//your-registry/:ca[]=${CERT1}
```

pnpm runs an env-substitution pass that calls `.replace()` on each value; for a scoped `…/:ca[]=` key the value is an array, so it throws. (Global `ca[]=` PEM lines are fine; only the scoped `:ca[]=` form breaks it.)

Permanent fix — remove just those scoped lines (a backup is cheap):

```bash
cp ~/.npmrc ~/.npmrc.bak
sed -i '' '/:ca\[\]=/d' ~/.npmrc   # macOS; use `sed -i '/:ca\[\]=/d' ~/.npmrc` on Linux
```

If you genuinely need a per-registry CA, use a file reference instead of the inline array:

```
//your-registry/:cafile=/absolute/path/to/ca.pem
```

Temporary, non-invasive alternative (per-command, bypasses your global config and its auth):

```bash
printf 'registry=https://registry.npmjs.org/\n' > /tmp/clean.npmrc
npm_config_userconfig=/tmp/clean.npmrc pnpm install
```

## License

[MIT](./LICENSE)
