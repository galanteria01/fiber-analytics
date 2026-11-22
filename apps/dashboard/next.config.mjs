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
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
