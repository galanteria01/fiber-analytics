# Compiler — Next.js adapter

> Use the FiberAnalytics compiler inside a Next.js app.

## Background

`@fiber-analytics/compiler` is bundler-agnostic. The transform itself is a Babel plugin (see `packages/compiler/src/transform.ts` and `packages/compiler/src/babel.ts`). Vite/webpack/Rollup/esbuild adapters are thin wrappers via `unplugin`.

Next.js uses **SWC** by default and does not run Babel unless you opt in. There are two ways to get tagging:

1. **Babel plugin** (recommended for FiberAnalytics) — add a `babel.config.js`; Next.js will switch that build to Babel. Slight build perf cost, but tagging works unchanged.
2. **webpack hook** — register the `unplugin` webpack adapter from `next.config.js`. Only covers the webpack build; App Router's SWC path is not intercepted. Prefer (1) when you need reliable JSX tagging.

## Option A — Babel plugin (recommended)

```bash
pnpm add -D @fiber-analytics/compiler
```

```js
// babel.config.js (at repo root)
module.exports = {
  presets: ['next/babel'],
  plugins: [['@fiber-analytics/compiler/babel', { includeSourceLocation: false }]],
};
```

No `next.config.js` change needed. Options are `TransformOptions` (see `docs/integration-vite.md` for the full table — `includeSourceLocation`, `propDenylist`, `interactiveTags`, `interactiveHandlers`, `include`, `rootDir`).

> **Note:** A custom Babel config disables some SWC optimizations (e.g. SWC's faster minify). For most apps the difference is negligible; measure if you are build-time sensitive.

## Option B — webpack hook

If you want to keep SWC but still tag the webpack output:

```js
// next.config.js
import { webpack as fiberAnalyticsWebpack } from '@fiber-analytics/compiler/webpack';

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack(config) {
    config.plugins.push(fiberAnalyticsWebpack({ includeSourceLocation: false }));
    return config;
  },
};

export default nextConfig;
```

Limitations: only the webpack compilation is tagged. If Next.js serves some routes purely via SWC without webpack, those JSX will not be tagged. Prefer Option A for correctness.

## Verifying tagging

After `pnpm --filter dashboard build` (or `next build`), inspect any interactive element in the emitted JS — it should carry `data-fa-comp`. Or enable `includeSourceLocation: true` and check for `data-fa-loc`.

## Related

- [Compiler — Vite adapter](integration-vite.md) — canonical option docs and prop-collection rules.
- [Browser SDK](integration-react.md) — runtime capture is unchanged regardless of bundler.
