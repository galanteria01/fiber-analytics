# Multi-stage build for the Next.js dashboard + ingestion edge.
# Build context is the monorepo root: `docker build -f apps/dashboard/Dockerfile .`
FROM node:20-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm build:packages
RUN pnpm --filter dashboard build

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app ./
WORKDIR /app/apps/dashboard
EXPOSE 3000
CMD ["pnpm", "start"]
