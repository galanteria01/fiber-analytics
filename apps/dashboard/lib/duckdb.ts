import { readdir } from 'node:fs/promises';
import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { ANALYTICS_DIR, PARQUET_GLOB } from './paths';

// A single in-process DuckDB connection is hoisted to module scope and reused
// across all requests (server-hoist-static-io). DuckDB reads cold Parquet files
// directly, so there is no long-lived relational server to manage.
let connectionPromise: Promise<DuckDBConnection> | null = null;

async function getConnection(): Promise<DuckDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const instance = await DuckDBInstance.create(':memory:');
      return instance.connect();
    })();
  }
  return connectionPromise;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return Number(value);
  return value;
}

function normalizeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key in row) out[key] = normalizeValue(row[key]);
  return out;
}

/**
 * Runs a read-only SQL query and returns plain row objects. BigInt counts are
 * coerced to numbers for easy serialization to client components.
 */
export async function query<T>(sql: string): Promise<T[]> {
  const connection = await getConnection();
  const reader = await connection.runAndReadAll(sql);
  const rows = reader.getRowObjects() as Record<string, unknown>[];
  return rows.map((row) => normalizeRow(row)) as T[];
}

/**
 * Recursively checks whether any Parquet partition has been written yet.
 * `read_parquet` throws on an empty glob, so callers guard with this first.
 */
export async function hasData(): Promise<boolean> {
  async function walk(dir: string): Promise<boolean> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (await walk(`${dir}/${entry.name}`)) return true;
      } else if (entry.name.endsWith('.parquet')) {
        return true;
      }
    }
    return false;
  }
  return walk(ANALYTICS_DIR);
}

/**
 * A read_parquet table expression over every partition, with hive partition
 * columns (domain/year/month/day) and union-by-name for schema resilience.
 */
export const EVENTS_SOURCE = `read_parquet('${PARQUET_GLOB}', hive_partitioning = true, union_by_name = true)`;
