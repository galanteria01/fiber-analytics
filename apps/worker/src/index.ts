import { createServer, type Server } from 'node:http';
import { config, log, logError, store } from './config.js';
import { runOnce } from './pipeline.js';

type HealthServer = Server & { updateHealth: (err: string | null) => void };

function delay(ms: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, ms);
  return promise;
}

function startHealthServer(): HealthServer | null {
  if (!config.healthPort) return null;
  let lastRunAt: string | null = null;
  let lastError: string | null = null;
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/health/') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, lastRunAt, lastError, uptime: process.uptime() }));
      return;
    }
    res.writeHead(404).end();
  }) as HealthServer;
  server.updateHealth = (err: string | null): void => {
    lastRunAt = new Date().toISOString();
    lastError = err;
  };
  server.listen(config.healthPort, () =>
    log('health server listening', { port: config.healthPort! }),
  );
  return server;
}

/**
 * Sync + compaction worker. Runs the raw -> Parquet pipeline on an interval,
 * or once with `--once` (used by `pnpm sync` for local one-shot syncing).
 */
async function main(): Promise<void> {
  const once = process.argv.includes('--once');
  log('worker starting', { store: store.kind, once, intervalMs: config.pollIntervalMs });

  if (once) {
    const count = await runOnce();
    log(count > 0 ? 'synced' : 'nothing to sync', { files: count });
    return;
  }

  const healthServer = startHealthServer();

  let stopping = false;
  const stop = (): void => {
    stopping = true;
    healthServer?.close();
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      const count = await runOnce();
      if (count > 0) log('synced', { files: count });
      healthServer?.updateHealth(null);
    } catch (error) {
      logError('pipeline error', {
        error: String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      healthServer?.updateHealth(String(error));
    }
    await delay(config.pollIntervalMs);
  }
  log('worker stopped');
}

void main();
