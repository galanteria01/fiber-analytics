import { fileURLToPath } from 'node:url';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // DuckDB ships native bindings; keep it external to the server bundle.
  serverExternalPackages: ['@duckdb/node-api'],
  // Pin file tracing to the monorepo root (multiple lockfiles exist higher up).
  outputFileTracingRoot: fileURLToPath(new URL('../../', import.meta.url)),
  // Linting is owned by the root flat ESLint config (`pnpm lint`); keep the
  // build focused on compilation and type-checking.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
