import type { ClientEvent } from './schema.js';

/**
 * Configuration accepted by the browser SDK's `init()`.
 */
export interface FiberAnalyticsConfig {
  /** Absolute URL of the ingestion endpoint. */
  endpoint: string;
  /** Logical application domain, used for storage partitioning. */
  domain: string;
  /** When true (and on localhost), renders the live validation overlay. */
  debug?: boolean;
  /** Max events buffered before an eager flush is attempted. Defaults to 25. */
  maxBatchSize?: number;
  /** Idle-callback timeout (ms) before forcing a flush. Defaults to 2000. */
  flushTimeout?: number;
}

/**
 * The request body posted to the ingestion edge.
 */
export interface IngestPayload {
  /** Application domain emitting the batch. */
  domain: string;
  /** One or more client events. */
  events: ClientEvent[];
}
