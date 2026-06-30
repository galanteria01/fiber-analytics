import { config, log, logError, store } from './config.js';
import { runOnce } from './pipeline.js';

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

  let stopping = false;
  const stop = (): void => {
    stopping = true;
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);

  while (!stopping) {
    try {
      const count = await runOnce();
      if (count > 0) log('synced', { files: count });
    } catch (error) {
      logError('pipeline error', { error: String(error) });
    }
    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }
  log('worker stopped');
}

void main();
