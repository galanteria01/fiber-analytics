import path from 'node:path';

/**
 * Root of the local "object store". Defaults to the repository `data/`
 * directory (two levels up from `apps/dashboard`). Override with `FA_DATA_DIR`.
 */
export const DATA_DIR = path.resolve(process.cwd(), process.env.FA_DATA_DIR ?? '../../data');

/** Raw JSONL events land here before being compiled into Parquet. */
export const BUFFER_DIR = path.join(DATA_DIR, 'buffer');

/** Hive-partitioned Parquet partitions live here. */
export const ANALYTICS_DIR = path.join(DATA_DIR, 'analytics');

/**
 * Glob DuckDB uses to read every Parquet partition. Forward slashes work on all
 * platforms inside DuckDB.
 */
export const PARQUET_GLOB = `${ANALYTICS_DIR.split(path.sep).join('/')}/**/*.parquet`;
