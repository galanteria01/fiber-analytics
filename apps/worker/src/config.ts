import path from 'node:path';
import { createObjectStoreFromEnv } from '@fiber-analytics/storage';

function int(value: string | undefined, fallback: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function optionalPort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return n;
}

/** Default local store root: the repository `data/` dir (two levels up). */
const DEFAULT_LOCAL_ROOT = path.resolve(process.cwd(), '../../data');

export const store = createObjectStoreFromEnv(process.env, DEFAULT_LOCAL_ROOT);

export const config = {
  pollIntervalMs: int(process.env.FA_WORKER_INTERVAL_MS, 4000),
  retentionDays: int(process.env.FA_RETENTION_DAYS, 90),
  /** Compact a partition once it accumulates more than this many files. */
  compactionThreshold: int(process.env.FA_COMPACTION_THRESHOLD, 8),
  /** Optional health port; undefined means disabled. */
  healthPort: optionalPort(process.env.FA_WORKER_HEALTH_PORT),
};
/** Minimal structured logger (matches the dashboard's JSON log format). */
export const log = (msg: string, fields?: Record<string, unknown>): void => {
  console.log(JSON.stringify({ level: 'info', time: new Date().toISOString(), msg, ...fields }));
};

export const logError = (msg: string, fields?: Record<string, unknown>): void => {
  console.error(JSON.stringify({ level: 'error', time: new Date().toISOString(), msg, ...fields }));
};
