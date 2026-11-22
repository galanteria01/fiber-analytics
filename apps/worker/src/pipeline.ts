import { randomUUID } from 'node:crypto';
import { RAW_PREFIX, PROCESSING_PREFIX, ANALYTICS_PREFIX } from '@fiber-analytics/storage';
import { store, config, log } from './config.js';
import { createConnection, RAW_COLUMNS, SELECT_COLUMNS } from './duck.js';

const DEDUP = 'QUALIFY row_number() OVER (PARTITION BY event_id ORDER BY timestamp DESC) = 1';

function uriList(keys: string[]): string {
  return `[${keys.map((k) => `'${store.uri(k)}'`).join(', ')}]`;
}

function partitionDir(key: string): string {
  return key.slice(0, key.lastIndexOf('/'));
}

/**
 * Atomically claims raw objects by moving them into the `processing/` prefix.
 * Any objects left in `processing/` from a previously crashed run are also
 * returned, providing crash recovery (at-least-once processing; the event_id
 * dedup makes the pipeline idempotent).
 */
export async function claim(): Promise<string[]> {
  const rawKeys = (await store.list(RAW_PREFIX)).filter((k) => k.endsWith('.ndjson'));
  const claimed: string[] = [];
  for (const key of rawKeys) {
    const base = key.slice(key.lastIndexOf('/') + 1);
    const dest = `${PROCESSING_PREFIX}/${base}`;
    try {
      await store.move(key, dest);
      claimed.push(dest);
    } catch {
      // already moved by a concurrent run; skip.
    }
  }
  const orphans = (await store.list(PROCESSING_PREFIX)).filter((k) => k.endsWith('.ndjson'));
  return Array.from(new Set([...claimed, ...orphans]));
}

/**
 * Reads claimed NDJSON, de-duplicates by `event_id`, and writes hive-partitioned
 * Parquet (`domain/year/month/day`). Deletes the processing objects only after
 * a successful write.
 */
export async function compile(processingKeys: string[]): Promise<number> {
  if (processingKeys.length === 0) return 0;
  const connection = await createConnection();
  try {
    const target = store.writeTarget(ANALYTICS_PREFIX);
    await connection.run(`
      COPY (
        SELECT ${SELECT_COLUMNS},
          domain,
          strftime(CAST(timestamp AS TIMESTAMP), '%Y') AS year,
          strftime(CAST(timestamp AS TIMESTAMP), '%m') AS month,
          strftime(CAST(timestamp AS TIMESTAMP), '%d') AS day
        FROM read_json(${uriList(processingKeys)}, columns = ${RAW_COLUMNS}, format = 'newline_delimited')
        ${DEDUP}
      )
      TO '${target}' (
        FORMAT PARQUET,
        PARTITION_BY (domain, year, month, day),
        OVERWRITE_OR_IGNORE 1,
        FILENAME_PATTERN 'events_{uuid}'
      )
    `);
  } finally {
    connection.closeSync();
  }
  await store.delete(processingKeys);
  return processingKeys.length;
}

/**
 * Merges small files within any partition that has accumulated more than the
 * configured threshold, de-duplicating by `event_id`. This bounds the file
 * count DuckDB must open per query and provides cross-batch deduplication.
 */
export async function compact(): Promise<number> {
  const keys = (await store.list(ANALYTICS_PREFIX)).filter((k) => k.endsWith('.parquet'));
  const byDir = new Map<string, string[]>();
  for (const key of keys) {
    const dir = partitionDir(key);
    const arr = byDir.get(dir);
    if (arr) arr.push(key);
    else byDir.set(dir, [key]);
  }

  let compacted = 0;
  const connection = await createConnection();
  try {
    for (const [dir, files] of byDir) {
      if (files.length <= config.compactionThreshold) continue;
      const glob = `${store.uri(dir)}/*.parquet`;
      const outKey = `${dir}/compacted-${randomUUID()}.parquet`;
      await connection.run(`
        COPY (
          SELECT * FROM read_parquet('${glob}', hive_partitioning = false, union_by_name = true)
          ${DEDUP}
        )
        TO '${store.uri(outKey)}' (FORMAT PARQUET)
      `);
      await store.delete(files);
      compacted += files.length;
      log('compacted partition', { dir, files: files.length });
    }
  } finally {
    connection.closeSync();
  }
  return compacted;
}

/** Deletes partitions whose date is older than the retention window. */
export async function prune(now: Date = new Date()): Promise<number> {
  const cutoff = now.getTime() - config.retentionDays * 24 * 60 * 60 * 1000;
  const keys = await store.list(ANALYTICS_PREFIX);
  const toDelete = keys.filter((key) => {
    const m = key.match(/year=(\d{4})\/month=(\d{2})\/day=(\d{2})/);
    if (!m) return false;
    const ms = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    return Number.isFinite(ms) && ms < cutoff;
  });
  if (toDelete.length > 0) {
    await store.delete(toDelete);
    log('pruned partitions', { count: toDelete.length });
  }
  return toDelete.length;
}

/** One full pipeline pass. Returns the number of source files compiled. */
export async function runOnce(): Promise<number> {
  const claimed = await claim();
  const count = await compile(claimed);
  await compact();
  await prune();
  return count;
}
