# Contributing to FiberAnalytics

Thanks for contributing. This guide covers setup, workflow, and expectations for pull requests.

## Development setup

Prerequisites: Node.js >= 20 and pnpm >= 10 (`corepack enable` or `npm i -g pnpm`).

```bash
# Clone and install
git clone https://github.com/galanteria01/fiber-analytics.git
cd fiber-analytics
pnpm install

# Build shared packages (core, storage, compiler, browser)
pnpm build:packages

# Run demo + dashboard together (demo on :5173, dashboard on :3000)
pnpm dev

# Or run them individually
pnpm --filter demo dev
pnpm --filter dashboard dev
```

Environment: copy `.env.example` to `apps/dashboard/.env.local` (for local dev) or to `.env` (for docker-compose). All variables are optional for local dev; see `.env.example` for defaults.

Sync buffered events into Parquet (requires the dashboard/ingest to have received events):

```bash
pnpm sync        # one-shot: raw NDJSON -> Parquet
pnpm worker      # long-lived: poll + compact + prune
```

Full stack with MinIO (local S3):

```bash
cp .env.example .env
docker compose up --build
```

## Project structure

```
packages/core          Shared event schema, validation, safelist
packages/storage       ObjectStore abstraction (local + S3)
packages/compiler      Build-time JSX auto-tagging (Vite/Next.js/Rollup/esbuild/Babel adapters)
packages/browser       Browser SDK (sessions, queue, transport)
apps/demo              Demo app exercising clicks/forms/routing
apps/dashboard         Next.js ingest + dashboard
apps/worker            Sync/compaction/pruning worker
examples/minimal-vite  Minimal smoke-test example
docs/                  Architecture, quickstart, integration, privacy, deployment
```

Read `docs/architecture.md` for module boundaries and data flow.

## Tests

```bash
pnpm -r test                        # all workspaces
pnpm --filter @fiber-analytics/browser test
pnpm --filter @fiber-analytics/compiler test
pnpm --filter @fiber-analytics/storage test
pnpm --filter dashboard test
pnpm --filter worker test
```

Add or update tests alongside code changes. New pipeline/storage/ingest logic should include coverage for the relevant package.

## Code style

- **Formatting:** Prettier (`pnpm format` to write, `pnpm format --check` in CI). Config in `.prettierrc.json`.
- **Linting:** ESLint (`pnpm lint`). Config in `eslint.config.mjs`.
- **TypeScript:** strict mode across the workspace (`tsconfig.base.json`). Run `pnpm --filter <pkg> typecheck` or `pnpm -r typecheck` where available.
- Keep files focused (one responsibility per file) and prefer existing patterns over new abstractions.

## Pull requests

1. Create a branch from `main` with a descriptive name (e.g. `fix/ingest-rate-limit`).
2. Make focused changes — avoid unrelated reformatting or scope creep.
3. Ensure all of the following pass locally:
   - `pnpm lint`
   - `pnpm --filter "./packages/*" typecheck` (and `pnpm --filter dashboard typecheck` / `worker` if you touched those apps)
   - `pnpm -r test`
   - `pnpm build` / `pnpm build:packages`
4. Update docs (`docs/`, `README.md`, or `examples/`) if behavior or public API changed.
5. Open a PR against `main` using the PR template. Link related issues (`Closes #123`).
6. CI must pass before merge. A maintainer (`CODEOWNERS`) will review.

## Commit hygiene

- Use clear, imperative commit messages (e.g. `fix: clamp ingest body size before parsing`).
- Keep commits logical and self-contained; squash noisy fixups before opening the PR.
- Do not commit `node_modules/`, `dist/` (except where published), `.env`, or generated `data/` contents.

## Reporting issues

Use the issue templates under `.github/ISSUE_TEMPLATE/` (bug report / feature request). For security vulnerabilities, see `SECURITY.md` — do not file them as public issues.
