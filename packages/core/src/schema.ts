/**
 * The category of a captured interaction.
 */
export type EventType = 'click' | 'view' | 'state_change';

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
 * A normalized telemetry record. Mirrors the columnar storage schema:
 * one row per interaction, immutable once written.
 */
export interface AnalyticsEvent {
  /** Unique identifier for the individual telemetry record. */
  event_id: string;
  /** Ephemeral 24-hour cryptographic session identifier. */
  session_hash: string;
  /** ISO 8601 UTC timestamp of event occurrence. */
  timestamp: string;
  /** Category of execution. */
  event_type: EventType;
  /** Extracted structural UI component identifier. */
  component_name: string;
  /** Dynamically injected component props or metadata. */
  properties: EventProperties;
  /** Relative window path where the action took place. */
  url_path: string;
}

/**
 * The client-emitted shape, before the edge enriches it with a session hash
 * and authoritative server timestamp.
 */
export type ClientEvent = Omit<AnalyticsEvent, 'session_hash'>;

/**
 * Ordered column list for the analytics schema, used when projecting rows into
 * columnar storage.
 */
export const EVENT_COLUMNS = [
  'event_id',
  'session_hash',
  'timestamp',
  'event_type',
  'component_name',
  'properties',
  'url_path',
] as const satisfies ReadonlyArray<keyof AnalyticsEvent>;
