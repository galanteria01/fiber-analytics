# Positioning

## Elevator pitch

FiberAnalytics is a component-aware analytics framework for React + Vite apps. A build-time plugin auto-tags every interactive JSX element with its component name, props, and source location; a tiny browser SDK captures those semantics in privacy-respecting session journeys; and the data lands as Parquet that DuckDB queries in-process — no cookies, no always-on database, no vendor lock-in.

## Problem statements

### 1. Manual instrumentation is brittle and expensive

Every analytics event today typically requires a hand-written `track("cta_clicked", { variant: props.variant })` call threaded through component trees. Those strings drift from the components they describe, prop shapes change without updating track calls, coverage is uneven (some flows are rich, others silent), and the maintenance tax grows with every feature. Onboarding a new teammate means teaching two systems: the UI and the shadow analytics wiring that mirrors it.

### 2. Generic page analytics loses component meaning

Page-view counters and URL-level funnels cannot tell you that the primary CTA outperformed the ghost CTA by 3x, or that the rating-stars component drives discovery. When analytics is URL-shaped and components are the unit of reuse, the mismatch makes product questions hard to answer without bespoke queries or extra ETL.

### 3. Cookie-based session stitching conflicts with privacy expectations

Third-party cookies are deprecated or blocked, cookie banners erode trust, and fingerprinting invites regulatory risk. Yet most session stitching still assumes a persistent cross-site identifier. Teams that want honest privacy defaults — not privacy as an afterthought — have few practical options that also preserve useful session-journey analysis.

### 4. Serverless ingestion needs hardening

A public `/api/ingest` endpoint faces bot traffic, oversized payloads, replayed events, origin spoofing, and unbounded storage growth. Hardening is not optional: without allowlists, rate limiting, bot filtering, body caps, and timestamp clamping, a single integration can become an availability and cost problem.

### 5. Running a relational database for small product analytics is overkill

A Postgres or MySQL instance provisioned just to hold clickstreams sits idle most of the day, needs migrations, backups, connection pooling, and monitoring — all for data that is append-only and naturally columnar. For small-to-medium product teams, the operational overhead dwarfs the querying benefit. Columnar Parquet + an in-process query engine is a better fit: cheap to store, fast to scan, trivial to own.

## Value propositions

| Proposition                                    | What it means in practice                                                                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Zero manual instrumentation**                | The Vite plugin walks JSX at build time and injects `data-fa-comp`, `data-fa-props`, and `data-fa-loc` onto interactive elements. No per-component `track()` calls for the common case; custom events via `track()`/`page()` remain available when you need them.                                                                                                                      |
| **Component-level semantics, not URL proxies** | Every event carries the originating component name, safelisted primitive props, and `file:line:col`. Dashboards can answer "which component?" and "which prop value?" without asking engineers to re-tag after the fact.                                                                                                                                                               |
| **Privacy by default**                         | Sessions are keyed on an ephemeral `sessionStorage` id with a 30-minute sliding window — no cookies, no fingerprint. IPs are truncated (/24 for IPv4, /48 for IPv6), the `session_hash` rotates with a daily secret, DNT/GPC and an explicit consent gate are honoured, sensitive keys are redacted at build and at ingest, and the worker prunes partitions past `FA_RETENTION_DAYS`. |
| **Hardened ingestion**                         | Origin and domain allowlists, body-size and per-batch event caps, per-IP rate limiting, bot user-agent filtering, content-type validation, and timestamp clamping are all built in. The same config surface governs behaviour across dev and production.                                                                                                                               |
| **Own your data, skip the always-on DB**       | Raw events land as NDJSON on your object store (local filesystem for dev, S3/MinIO for prod); the worker compiles them into hive-partitioned Parquet (`domain/year/month/day`) with `event_id` deduplication. DuckDB reads those Parquet files directly — fast, cheap, and fully in your bucket.                                                                                       |
| **Pluggable storage, single schema**           | The `ObjectStore` abstraction has local and S3 adapters behind identical `list`/`move`/`delete`/`glob`/`uri` methods. `@fiber-analytics/core` is the single source of truth for the event schema, so column evolution is additive and old Parquet stays readable via `union_by_name`.                                                                                                  |

## Target personas

### React + Vite teams

You ship interactive UIs in Vite and want analytics that matches how you actually build: per component, per prop, per file — without maintaining a parallel tracking layer. You already use (or are willing to adopt) a Vite plugin; FiberAnalytics fits that workflow with `enforce: "pre"` before `@vitejs/plugin-react`.

### Small product teams

You need sessions, funnels, top-component breakdowns, per-session timelines, and path analysis — without provisioning a warehouse, hiring a data team, or committing to a vendor contract. Parquet + DuckDB gives you real analytics at near-zero infra cost for the scale you actually have.

### Privacy-conscious teams

You operate under GDPR/CCPA expectations (or just prefer honest defaults), want cookieless session journeys instead of cross-site identifiers, and need IP truncation and retention pruning to be real features with tests, not marketing copy.

### Self-hosters

You want to run the whole pipeline — ingest edge, Parquet compaction worker, and dashboard — on your own infrastructure (Vercel + a worker host, or a single Docker Compose stack with MinIO). You value data ownership, air-gappable storage, and reproducible local dev over a multi-tenant SaaS.

## Differentiators

### Auto-tagging at the compiler boundary

Most tools instrument at runtime. FiberAnalytics instruments at compile time via a Babel transform over the Vite graph. That means component identity and prop snapshots are captured before JSX is even emitted, with denylist filtering and `data-fa-ignore` opt-out handled once at build rather than in every component.

### Cookieless sessions with explicit consent

Sessions live in `sessionStorage` with a sliding 30-minute expiry. A secondary `session_hash` (`sha256(userAgent + truncatedIP + dailySecret)`) is kept only as a correlation/bot signal and rotates per UTC day. DNT, GPC, and an explicit consent banner gate can each suppress capture independently — and the dashboard never shows a cookie banner because there are no cookies.

### Parquet + DuckDB, not an OLTP database

The worker (`claim` → `compile` → `compact` → `prune`) deduplicates by `event_id` into hive-partitioned Parquet; DuckDB's `read_parquet(..., hive_partitioning = true)` scans only the partitions a query needs. No migrations, no connection pool, no idle server. For small-to-medium volumes this is dramatically cheaper and simpler than running Postgres just for analytics.

### S3/local pluggable storage

The `ObjectStore` interface backs both modes: local filesystem for zero-config dev, S3/MinIO for production and Docker Compose. The same write/claim/compile/prune code runs against either, so switching is a single env var (`FA_STORAGE=s3`).

## Comparison

All claims are as of 2026-11-22 and refer to the vendors' documented self-serve offerings. FiberAnalytics is a framework you deploy; hosted vendors below are compared on their managed products.

| Dimension                | FiberAnalytics                                                               | Segment                                                       | PostHog                                                           | Mixpanel                                                  | Plausible                                            | Umami                                             |
| ------------------------ | ---------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------- |
| Primary use case         | Component-level UI analytics for React/Vite teams                            | Customer-data pipeline (collect → route to 300+ destinations) | Product analytics + feature flags + A/B + error tracking          | Product analytics + funnels + cohorts + experiments       | Lightweight web traffic analytics                    | Lightweight web traffic analytics (self-hostable) |
| Integration effort       | Vite plugin (build) + `init()` (SDK); zero per-component wiring              | SDK per event + destination config                            | SDK + autocapture + manual events                                 | SDK + manual events                                       | Script tag                                           | Script tag                                        |
| Component / prop context | Automatic (`data-fa-comp`, safelisted props, source location)                | Manual properties per `track()`                               | Manual; autocapture has element text/class but not component name | Manual                                                    | Page-level only                                      | Page-level only                                   |
| Session model            | Cookieless session journeys (`sessionStorage` + sliding window)              | Cookie + userId                                               | Cookie (session-journey style available)                          | Cookie + distinct_id                                      | Cookieless (optional)                                | Cookieless (optional)                             |
| Session-journey detail   | Per-session timeline with component, props, and source loc                   | No session-journey UI (raw events forwarded elsewhere)        | Session timeline / journeys product                               | Session timeline via flows                                | No session-journey view                              | No session-journey view                           |
| Data ownership           | You own the Parquet files (S3 or local)                                      | Events forwarded to your/3rd-party warehouses                 | Cloud or self-hosted Postgres + ClickHouse                        | Vendor warehouse (export via pipeline add-on)             | Cloud or self-hosted                                 | Cloud or self-hosted                              |
| Storage / query engine   | Parquet (hive-partitioned) + DuckDB in-process                               | Your warehouses (BigQuery/Redshift/etc.)                      | ClickHouse (self-host) or vendor cloud                            | Vendor OLAP backend                                       | Vendor backend / self-hosted DB                      | Vendor backend / self-hosted DB                   |
| Always-on DB required    | No                                                                           | Depends on chosen destinations                                | Yes for self-host                                                 | No (vendor-managed)                                       | No (vendor-managed)                                  | No (vendor-managed)                               |
| Privacy posture          | No cookies, IP truncation, daily secret rotation, DNT/GPC, retention pruning | Depends on destinations; cookies typically used               | Configurable; cookieless mode available                           | Cookie-based; consent APIs available                      | Privacy-friendly by design                           | Privacy-friendly by design                        |
| Hosting                  | Self-hosted only (you deploy dashboard + worker)                             | Hosted service                                                | Hosted or self-hosted                                             | Hosted                                                    | Hosted or self-hosted                                | Hosted or self-hosted                             |
| Cost at small scale      | Infra cost only (object storage + compute)                                   | Free tier then per-MTU                                        | Generous free tier then per-event                                 | Free tier then per-event                                  | Per-site pricing                                     | Free (self-host) or per-site (cloud)              |
| Best when…               | You build in React/Vite and want component analytics you control             | You need to fan events to many downstream tools               | You want an all-in-one product stack                              | You want mature funnel/cohort/experiment tooling at scale | You want simple page analytics without product depth | You want simple page analytics self-hosted        |

### Reading the table honestly

- FiberAnalytics is **narrower** than Segment/PostHog/Mixpanel by design. It does not try to be a CDP, a feature-flag system, or a warehouse router. If you need those, pair it with — or choose — one of those tools.
- Plausible/Umami are **lighter** still: excellent for page-level traffic, not for component-level product questions. FiberAnalytics sits between them and the heavier product-analytics platforms.
- Vendor claims drift; verify pricing and self-host status directly before deciding.

## What FiberAnalytics is not

Be explicit about scope so adopters choose with eyes open.

- **No session replay.** There is no DOM capture, no pixel recording, and no replay viewer. The word "session-journey" in this project means a chronological, component-annotated event timeline — not visual replay. Do not use this project if you need to watch users' screens back.

- **No user identity.** There is no login-based `userId`, no `identify()` call, no cross-device stitching, and no PII collection path. Sessions are anonymous and ephemeral by construction.

- **No hosted SaaS.** There is no `app.fiberanalytics.com`, no multi-tenant control plane, and no vendor-managed storage. You run the dashboard, the worker, and the bucket. That is the point: data ownership is non-negotiable.

If those capabilities are central to your needs, Segment, PostHog, or Mixpanel are a better fit — or run FiberAnalytics alongside them for the component layer they do not provide.
