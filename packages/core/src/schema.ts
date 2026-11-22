/**
 * Current event schema version. Bumped whenever the persisted shape changes so
 * that readers can evolve while old Parquet files remain queryable.
 */
export const SCHEMA_VERSION = 2;

/**
 * The category of a captured interaction.
 */
export type EventType =
  'click' | 'view' | 'state_change' | 'page_view' | 'submit' | 'input' | 'custom';

/**
 * Coarse device classification derived from the viewport / user agent hints.
 */
export type DeviceClass = 'mobile' | 'tablet' | 'desktop';

/**
 * Only JSON primitives are ever persisted as component properties. This keeps
 * payloads small and avoids accidentally capturing PII held in objects.
 */
export type PrimitiveValue = string | number | boolean | null;

/**
 * Safelisted component properties extracted at build time or capture time.
 */
export type EventProperties = Record<string, PrimitiveValue>;

/**
 * Per-page context captured once and attached to every event on that page.
 * Flattened into {@link AnalyticsEvent} for columnar-friendly storage.
 */
export interface EventContext {
  referrer?: string;
  page_title?: string;
  viewport_w?: number;
  viewport_h?: number;
  locale?: string;
  device?: DeviceClass;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
}

/**
 * A normalized telemetry record (schema v2). One row per interaction, immutable
 * once written. Journey identity is carried client-side via
 * `session_id`/`pageview_id`/`seq`; `session_hash` is a server-derived secondary
 * signal used for bot/abuse cross-checks.
 */
export interface AnalyticsEvent extends EventContext {
  /** Persisted schema version. */
  schema_version: number;
  /** Unique identifier for the individual telemetry record. */
  event_id: string;
  /** Ephemeral client session id (sliding inactivity window, cookieless). */
  session_id: string;
  /** Server-derived ephemeral 24h cryptographic session identifier. */
  session_hash: string;
  /** Identifier for the page view the event occurred within. */
  pageview_id: string;
  /** Monotonic per-session sequence number for deterministic ordering. */
  seq: number;
  /** Client-side high-resolution ISO 8601 UTC time the event occurred. */
  occurred_at: string;
  /** Server-authoritative ISO 8601 UTC receive time. */
  timestamp: string;
  /** Category of execution. */
  event_type: EventType;
  /** Name for custom/manual events (`event_type === 'custom'`). */
  event_name?: string;
  /** Extracted structural UI component identifier (empty for page views). */
  component_name: string;
  /** Dynamically injected component props or metadata. */
  properties: EventProperties;
  /** Relative window path where the action took place. */
  url_path: string;
  /** Build-time source location (`file:line:col`) for trace-to-source. */
  source_loc?: string;
}

/**
 * The client-emitted shape, before the edge enriches it with a session hash and
 * an authoritative server timestamp.
 */
export type ClientEvent = Omit<AnalyticsEvent, 'session_hash' | 'timestamp'>;

/**
 * Ordered column list for the analytics schema, used when projecting rows into
 * columnar storage.
 */
export const EVENT_COLUMNS = [
  'schema_version',
  'event_id',
  'session_id',
  'session_hash',
  'pageview_id',
  'seq',
  'occurred_at',
  'timestamp',
  'event_type',
  'event_name',
  'component_name',
  'properties',
  'url_path',
  'source_loc',
  'referrer',
  'page_title',
  'viewport_w',
  'viewport_h',
  'locale',
  'device',
  'utm_source',
  'utm_medium',
  'utm_campaign',
] as const satisfies ReadonlyArray<keyof AnalyticsEvent>;
