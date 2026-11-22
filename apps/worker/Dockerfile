# Standalone sync + compaction worker.
# Build context is the monorepo root: `docker build -f apps/worker/Dockerfile .`
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build:packages

FROM build AS runner
ENV NODE_ENV=production
WORKDIR /app/apps/worker
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s CMD node -e "const p=process.env.FA_WORKER_HEALTH_PORT; if(!p)process.exit(0); fetch('http://127.0.0.1:'+p+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["pnpm", "start"]
