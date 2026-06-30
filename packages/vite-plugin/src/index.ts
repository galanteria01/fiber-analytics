import type { Plugin } from 'vite';
import { transformSource } from './transform.js';

const JSX_FILE = /\.(jsx|tsx)$/;
const NODE_MODULES = /node_modules/;

export interface FiberAnalyticsPluginOptions {
  /**
   * Additional include test. By default all non-`node_modules` `.jsx`/`.tsx`
   * files are processed.
   */
  include?: (id: string) => boolean;
}

/**
 * Vite plugin that auto-tags interactive JSX elements with `data-fa-comp` and
 * `data-fa-props` so the browser SDK can capture semantic UI context with zero
 * manual instrumentation.
 *
 * Registered with `enforce: 'pre'` so it runs before `@vitejs/plugin-react`
 * compiles the JSX away.
 */
export function fiberAnalytics(options: FiberAnalyticsPluginOptions = {}): Plugin {
  const { include } = options;

  return {
    name: 'fiber-analytics',
    enforce: 'pre',
    transform(code, id) {
      const [filename] = id.split('?');
      if (!filename || !JSX_FILE.test(filename)) return null;
      if (NODE_MODULES.test(filename)) return null;
      if (include && !include(filename)) return null;

      const result = transformSource(code, filename);
      if (!result) return null;
      return { code: result.code, map: result.map ?? null };
    },
  };
}

export default fiberAnalytics;

export { transformSource } from './transform.js';
