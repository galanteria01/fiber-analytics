import { createUnplugin } from 'unplugin';
import { transformSource, type TransformOptions } from './transform.js';

const JSX_FILE = /\.(jsx|tsx)$/;
const NODE_MODULES = /node_modules/;

export interface FiberAnalyticsPluginOptions extends TransformOptions {
  /** Additional include test. Defaults to all non-node_modules .jsx/.tsx files. */
  include?: (id: string) => boolean;
}

const unplugin = createUnplugin<FiberAnalyticsPluginOptions | undefined, false>(
  (options = {}) => {
    const { include, ...transformOptions } = options;
    let rootDir = transformOptions.rootDir ?? process.cwd();

    return {
      name: 'fiber-analytics',

      // Vite hook — capture resolved root for stable source-location paths
      vite: {
        configResolved(config: { root: string }) {
          if (!transformOptions.rootDir) rootDir = config.root;
        },
      },

      // Webpack: expose via compiler options if needed
      webpack(_compiler: unknown) {
        // rootDir stays as cwd or explicit option for webpack
      },

      transform(code: string, id: string) {
        const [filename] = id.split('?');
        if (!filename || !JSX_FILE.test(filename)) return null;
        if (NODE_MODULES.test(filename)) return null;
        if (include && !include(filename)) return null;

        const result = transformSource(code, filename, { ...transformOptions, rootDir });
        if (!result) return null;
        return { code: result.code, map: result.map ?? null };
      },
    };
  },
);

// Vite plugin
export const vite = unplugin.vite;
// Webpack plugin
export const webpack = unplugin.webpack;
// Rollup plugin (also covers Rolldown)
export const rollup = unplugin.rollup;
// esbuild plugin
export const esbuild = unplugin.esbuild;
// Astro integration helper (delegates to Vite under the hood)
export const astro = unplugin.vite;

// Default / named export — auto-detect via unplugin
export const fiberAnalytics = unplugin;
export default unplugin;
