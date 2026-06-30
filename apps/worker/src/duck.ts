import { DuckDBInstance, type DuckDBConnection } from '@duckdb/node-api';
import { store } from './config.js';

/**
 * Creates a fresh DuckDB connection configured with the object store's httpfs /
 * S3 setup statements (a no-op for the local adapter). Each pipeline run uses a
 * short-lived connection so a crash can never leak a half-written transaction.
 */
export async function createConnection(): Promise<DuckDBConnection> {
  const instance = await DuckDBInstance.create(':memory:');
  const connection = await instance.connect();
  for (const stmt of store.duckdbSetup()) {
    await connection.run(stmt);
  }
  return connection;
}

/**
 * The explicit JSON column schema for raw NDJSON. Declaring it (rather than
 * auto-detecting) guarantees a stable Parquet schema even when optional fields
 * are absent from a given batch.
 */
export const RAW_COLUMNS = `{
  schema_version: 'INTEGER',
  event_id: 'VARCHAR',
  session_id: 'VARCHAR',
  session_hash: 'VARCHAR',
  pageview_id: 'VARCHAR',
  seq: 'BIGINT',
  occurred_at: 'VARCHAR',
  timestamp: 'VARCHAR',
  event_type: 'VARCHAR',
  event_name: 'VARCHAR',
  component_name: 'VARCHAR',
  properties: 'VARCHAR',
  url_path: 'VARCHAR',
  source_loc: 'VARCHAR',
  referrer: 'VARCHAR',
  page_title: 'VARCHAR',
  viewport_w: 'INTEGER',
  viewport_h: 'INTEGER',
  locale: 'VARCHAR',
  device: 'VARCHAR',
  utm_source: 'VARCHAR',
  utm_medium: 'VARCHAR',
  utm_campaign: 'VARCHAR',
  domain: 'VARCHAR'
}`;

/** The ordered analytics columns selected into Parquet (data columns only). */
export const SELECT_COLUMNS = `
  schema_version,
  event_id,
  session_id,
  session_hash,
  pageview_id,
  seq,
  CAST(occurred_at AS TIMESTAMP) AS occurred_at,
  CAST(timestamp AS TIMESTAMP) AS timestamp,
  event_type,
  event_name,
  component_name,
  properties,
  url_path,
  source_loc,
  referrer,
  page_title,
  viewport_w,
  viewport_h,
  locale,
  device,
  utm_source,
  utm_medium,
  utm_campaign
`;
