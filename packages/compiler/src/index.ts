// Bundler-agnostic compiler core — re-export transform primitives.
export {
  transformSource,
  type TransformOptions,
  type TransformResult,
  type RawSourceMap,
} from './transform.js';

// Re-export the unplugin adapter (works with Vite, webpack, Rollup, esbuild, Astro, etc.)
export { fiberAnalytics as default, fiberAnalytics } from './unplugin.js';
export type { FiberAnalyticsPluginOptions } from './unplugin.js';

// Babel plugin factory (for babel.config.js / Next.js / .babelrc usage)
export { default as babelPlugin, createBabelPlugin } from './babel.js';
