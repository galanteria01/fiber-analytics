// Webpack entry — exposes the webpack plugin factory as both `webpack` and `fiberAnalytics`
import { webpack as webpackPlugin } from './unplugin.js';
export { webpackPlugin as webpack, webpackPlugin as fiberAnalytics, webpackPlugin as default };
export type { FiberAnalyticsPluginOptions } from './unplugin.js';
