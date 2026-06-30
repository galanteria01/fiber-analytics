import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  minify: true,
  sourcemap: true,
  // Inline @fiber-analytics/core so consumers get a single self-contained bundle.
  noExternal: ['@fiber-analytics/core'],
});
