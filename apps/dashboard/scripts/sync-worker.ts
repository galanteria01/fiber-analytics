import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DuckDBInstance } from '@duckdb/node-api';
import { ANALYTICS_DIR, BUFFER_DIR } from '../lib/paths';

const POLL_INTERVAL_MS = 4000;

function sqlList(paths: string[]): string {
  return `[${paths.map((p) => `'${p.split(path.sep).join('/')}'`).join(', ')}]`;
}

/**
 * Atomically claims the current buffer files by renaming them to `.processing`.
 * Renaming is atomic, so events written after this point land in fresh files
 * and are picked up on the next run instead of being lost.
 */
async function claimBufferFiles(): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(BUFFER_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  const claimed: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const from = path.join(BUFFER_DIR, entry.name);
    const to = `${from}.processing`;
    await rename(from, to);
    claimed.push(to);
  }
  return claimed;
}

/**
 * Compiles a set of claimed JSONL files into hive-partitioned Parquet:
 *   analytics/domain=.../year=.../month=.../day=.../events_<uuid>.parquet
 */
async function compileToParquet(files: string[]): Promise<void> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();

  const target = ANALYTICS_DIR.split(path.sep).join('/');
  const source = `read_json(${sqlList(files)}, format = 'newline_delimited', auto_detect = true)`;

  await connection.run(`
    COPY (
      SELECT
        event_id,
        session_hash,
        CAST(timestamp AS TIMESTAMP) AS timestamp,
        event_type,
        component_name,
        CAST(properties AS VARCHAR) AS properties,
        url_path,
        domain,
        strftime(CAST(timestamp AS TIMESTAMP), '%Y') AS year,
        strftime(CAST(timestamp AS TIMESTAMP), '%m') AS month,
        strftime(CAST(timestamp AS TIMESTAMP), '%d') AS day
      FROM ${source}
    )
    TO '${target}' (
      FORMAT PARQUET,
      PARTITION_BY (domain, year, month, day),
      OVERWRITE_OR_IGNORE 1,
      FILENAME_PATTERN 'events_{uuid}'
    )
  `);

  connection.closeSync();
}

async function runOnce(): Promise<number> {
  await mkdir(ANALYTICS_DIR, { recursive: true });
  const files = await claimBufferFiles();
  if (files.length === 0) return 0;

  await compileToParquet(files);
  await Promise.all(files.map((file) => rm(file, { force: true })));
  return files.length;
}

async function main(): Promise<void> {
  const watch = process.argv.includes('--watch');

  if (!watch) {
    const count = await runOnce();
    console.log(
      count > 0
        ? `Compiled ${count} buffer file(s) into Parquet partitions under ${ANALYTICS_DIR}`
        : 'No buffered events to sync.',
    );
    return;
  }

  console.log(`Sync worker watching ${BUFFER_DIR} (every ${POLL_INTERVAL_MS}ms). Ctrl+C to stop.`);
  while (true) {
    try {
      const count = await runOnce();
      if (count > 0) console.log(`[${new Date().toISOString()}] synced ${count} file(s)`);
    } catch (error) {
      console.error('sync error:', error);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

void main();
