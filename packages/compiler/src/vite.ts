// Vite entry — exposes the Vite plugin factory as both `vite` and `fiberAnalytics`
// so consumers can write `fiberAnalytics({...})` (not `fiberAnalytics.vite({...})`).
import { vite as vitePlugin } from './unplugin.js';
export { vitePlugin as vite, vitePlugin as fiberAnalytics, vitePlugin as default };
export type { FiberAnalyticsPluginOptions } from './unplugin.js';
