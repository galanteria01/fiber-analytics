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
CMD ["pnpm", "start"]
