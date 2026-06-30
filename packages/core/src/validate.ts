import type { ClientEvent, EventType } from './schema.js';
import type { IngestPayload } from './types.js';
import { safelistProps } from './safelist.js';

const EVENT_TYPES = new Set<EventType>(['click', 'view', 'state_change']);

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPES.has(value as EventType);
}

function sanitizeEvent(raw: unknown): ClientEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!isEventType(e.event_type)) return null;
  if (typeof e.component_name !== 'string' || e.component_name.length === 0) return null;
  if (typeof e.url_path !== 'string') return null;

  const properties =
    e.properties && typeof e.properties === 'object' && !Array.isArray(e.properties)
      ? safelistProps(e.properties as Record<string, unknown>)
      : {};

  return {
    event_id: typeof e.event_id === 'string' ? e.event_id : crypto.randomUUID(),
    timestamp: typeof e.timestamp === 'string' ? e.timestamp : new Date().toISOString(),
    event_type: e.event_type,
    component_name: e.component_name,
    properties,
    url_path: e.url_path,
  };
}

/**
 * Validates and normalizes an untrusted ingest payload. Returns `null` when the
 * payload is structurally invalid; otherwise returns a payload containing only
 * well-formed, safelisted events.
 */
export function validateIngestPayload(raw: unknown): IngestPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  if (typeof body.domain !== 'string' || body.domain.length === 0) return null;
  if (!Array.isArray(body.events)) return null;

  const events: ClientEvent[] = [];
  for (const candidate of body.events) {
    const event = sanitizeEvent(candidate);
    if (event) events.push(event);
  }

  if (events.length === 0) return null;
  return { domain: body.domain, events };
}
