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
  /**
   * Initial consent state. When false, events are dropped until `setConsent(true)`
   * is called. Defaults to true.
   */
  consent?: boolean;
  /** Honor the browser Do-Not-Track / Global Privacy Control signals. Defaults to true. */
  respectDnt?: boolean;
  /** Session inactivity window in ms before a new session id is minted. Defaults to 30m. */
  sessionTimeoutMs?: number;
  /** Automatically emit `page_view` events on SPA navigations. Defaults to true. */
  trackPageViews?: boolean;
  /** Max delivery retry attempts for a failed batch. Defaults to 3. */
  maxRetries?: number;
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
