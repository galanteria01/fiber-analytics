/**
 * A minimal object-store abstraction shared by the ingestion edge (writes raw
 * NDJSON) and the worker / dashboard (reads + compacts Parquet). Two adapters
 * implement it: a local filesystem store (default, for dev) and an
 * S3-compatible store (production / MinIO).
 */
export interface ObjectStore {
  readonly kind: 'local' | 's3';

  /** Writes (overwrites) an object at `key`. */
  put(key: string, body: string | Uint8Array): Promise<void>;

  /** Reads an object as UTF-8 text. */
  get(key: string): Promise<string>;

  /** Lists object keys under a prefix (recursive), relative to the store root. */
  list(prefix: string): Promise<string[]>;

  /** Deletes the given object keys (best-effort, ignores missing). */
  delete(keys: string[]): Promise<void>;

  /** Atomically (or copy+delete) moves an object from one key to another. */
  move(fromKey: string, toKey: string): Promise<void>;

  /** A DuckDB-readable URI for a single object key. */
  uri(key: string): string;

  /** A DuckDB-readable glob URI for objects under `prefix` matching `pattern`. */
  glob(prefix: string, pattern: string): string;

  /** Directory-style URI used as a `COPY ... TO` target for partitioned writes. */
  writeTarget(prefix: string): string;

  /** SQL statements to execute on a DuckDB connection before reads/writes. */
  duckdbSetup(): string[];
}

export interface S3Options {
  bucket: string;
  region?: string;
  /** Custom endpoint for S3-compatible stores (e.g. MinIO `http://localhost:9000`). */
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  /** Base key prefix within the bucket (optional namespacing). */
  prefix?: string;
  /** Path-style addressing, required by MinIO. Defaults to true when endpoint is set. */
  forcePathStyle?: boolean;
}
