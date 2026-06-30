import { DuckDBInstance, type DuckDBConnection, type DuckDBValue } from '@duckdb/node-api';
import { getStore, ANALYTICS_PREFIX } from './store';

// A single in-process DuckDB connection is hoisted to module scope and reused
// across all requests. DuckDB reads cold Parquet files directly (local or via
// httpfs for S3), so there is no long-lived relational server to manage.
let connectionPromise: Promise<DuckDBConnection> | null = null;

async function getConnection(): Promise<DuckDBConnection> {
  if (!connectionPromise) {
    connectionPromise = (async () => {
      const instance = await DuckDBInstance.create(':memory:');
      const connection = await instance.connect();
      // Configure httpfs / S3 secrets when using the S3 adapter.
      for (const stmt of getStore().duckdbSetup()) {
        await connection.run(stmt);
      }
      return connection;
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
 * Runs a read-only SQL query and returns plain row objects. Pass bound
 * `params` for any user-driven values to avoid SQL injection. BigInt counts are
 * coerced to numbers for easy serialization to client components.
 */
export async function query<T>(sql: string, params: DuckDBValue[] = []): Promise<T[]> {
  const connection = await getConnection();
  const reader =
    params.length > 0
      ? await connection.runAndReadAll(sql, params)
      : await connection.runAndReadAll(sql);
  const rows = reader.getRowObjects() as Record<string, unknown>[];
  return rows.map((row) => normalizeRow(row)) as T[];
}

/**
 * Checks whether any Parquet partition exists yet. `read_parquet` throws on an
 * empty glob, so callers guard with this first. Works for both local and S3.
 */
export async function hasData(): Promise<boolean> {
  try {
    const keys = await getStore().list(ANALYTICS_PREFIX);
    return keys.some((key) => key.endsWith('.parquet'));
  } catch {
    return false;
  }
}

/** Raw `read_parquet` expression over every partition (union-by-name + hive). */
function rawParquet(): string {
  return `read_parquet('${getStore().glob(ANALYTICS_PREFIX, '*.parquet')}', hive_partitioning = true, union_by_name = true)`;
}

/**
 * Canonical v2 column set with DuckDB types. Any column missing from the
 * underlying Parquet (e.g. legacy v1 files written before schema v2) is
 * synthesized as a typed `NULL`, so queries can reference the full schema
 * regardless of which version wrote a given partition.
 */
const CANONICAL_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['event_id', 'VARCHAR'],
  ['schema_version', 'INTEGER'],
  ['session_id', 'VARCHAR'],
  ['pageview_id', 'VARCHAR'],
  ['seq', 'BIGINT'],
  ['session_hash', 'VARCHAR'],
  ['timestamp', 'TIMESTAMP'],
  ['occurred_at', 'TIMESTAMP'],
  ['event_type', 'VARCHAR'],
  ['event_name', 'VARCHAR'],
  ['component_name', 'VARCHAR'],
  ['properties', 'VARCHAR'],
  ['url_path', 'VARCHAR'],
  ['referrer', 'VARCHAR'],
  ['page_title', 'VARCHAR'],
  ['viewport_w', 'INTEGER'],
  ['viewport_h', 'INTEGER'],
  ['locale', 'VARCHAR'],
  ['device', 'VARCHAR'],
  ['utm_source', 'VARCHAR'],
  ['utm_medium', 'VARCHAR'],
  ['utm_campaign', 'VARCHAR'],
  ['utm_term', 'VARCHAR'],
  ['utm_content', 'VARCHAR'],
  ['source_loc', 'VARCHAR'],
  ['domain', 'VARCHAR'],
  ['year', 'VARCHAR'],
  ['month', 'VARCHAR'],
  ['day', 'VARCHAR'],
];

let sourceCache: { signature: string; sql: string } | null = null;

/** Returns the set of column names actually present in the Parquet files. */
async function describeColumns(): Promise<Set<string>> {
  const connection = await getConnection();
  const reader = await connection.runAndReadAll(`DESCRIBE SELECT * FROM ${rawParquet()}`);
  const rows = reader.getRowObjects() as Record<string, unknown>[];
  return new Set(rows.map((r) => String(r.column_name)));
}

/**
 * A normalized, schema-resilient events source: a subquery that projects the
 * full canonical v2 column set, filling any columns absent from the Parquet
 * with typed `NULL`s. Cached per distinct underlying schema. Only call once
 * {@link hasData} is true, since `read_parquet` throws on an empty glob.
 */
export async function eventsSource(): Promise<string> {
  const present = await describeColumns();
  const signature = [...present].sort().join(',');
  if (sourceCache?.signature === signature) return sourceCache.sql;

  const projection = CANONICAL_COLUMNS.map(([name, type]) =>
    present.has(name) ? name : `CAST(NULL AS ${type}) AS ${name}`,
  ).join(', ');
  const sql = `(SELECT ${projection} FROM ${rawParquet()}) AS fa_events`;
  sourceCache = { signature, sql };
  return sql;
}
