import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fiberAnalytics } from '@fiber-analytics/vite-plugin';

export default defineConfig({
  // fiberAnalytics is registered before plugin-react (enforce: 'pre') so it can
  // tag JSX before React compiles it away.
  plugins: [fiberAnalytics({ includeSourceLocation: true }), react()],
  server: {
    port: 5173,
  },
});
