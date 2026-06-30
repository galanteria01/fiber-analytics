import {
  SCHEMA_VERSION,
  type ClientEvent,
  type DeviceClass,
  type EventType,
} from './schema.js';
import type { IngestPayload } from './types.js';
import { safelistProps } from './safelist.js';
import { clampTimestamp } from './time.js';

const EVENT_TYPES = new Set<EventType>([
  'click',
  'view',
  'state_change',
  'page_view',
  'submit',
  'input',
  'custom',
]);

const DEVICE_CLASSES = new Set<DeviceClass>(['mobile', 'tablet', 'desktop']);

/** Hard caps to bound payload size / abuse. */
export const MAX_EVENTS_PER_BATCH = 500;
const MAX_STRING_LEN = 2048;

function isEventType(value: unknown): value is EventType {
  return typeof value === 'string' && EVENT_TYPES.has(value as EventType);
}

function optString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) : value;
}

function reqString(value: unknown, fallback = ''): string {
  return optString(value) ?? fallback;
}

function optNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optDevice(value: unknown): DeviceClass | undefined {
  return typeof value === 'string' && DEVICE_CLASSES.has(value as DeviceClass)
    ? (value as DeviceClass)
    : undefined;
}

function randomId(): string {
  // crypto.randomUUID is available in modern browsers and Node >= 16.
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeEvent(raw: unknown, now: Date): ClientEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Record<string, unknown>;

  if (!isEventType(e.event_type)) return null;
  if (typeof e.url_path !== 'string') return null;

  const properties =
    e.properties && typeof e.properties === 'object' && !Array.isArray(e.properties)
      ? safelistProps(e.properties as Record<string, unknown>)
      : {};

  return {
    schema_version: optNumber(e.schema_version) ?? SCHEMA_VERSION,
    event_id: reqString(e.event_id, randomId()),
    session_id: reqString(e.session_id, ''),
    pageview_id: reqString(e.pageview_id, ''),
    seq: optNumber(e.seq) ?? 0,
    occurred_at: clampTimestamp(e.occurred_at, now),
    event_type: e.event_type,
    event_name: optString(e.event_name),
    component_name: reqString(e.component_name, ''),
    properties,
    url_path: reqString(e.url_path, '/'),
    source_loc: optString(e.source_loc),
    referrer: optString(e.referrer),
    page_title: optString(e.page_title),
    viewport_w: optNumber(e.viewport_w),
    viewport_h: optNumber(e.viewport_h),
    locale: optString(e.locale),
    device: optDevice(e.device),
    utm_source: optString(e.utm_source),
    utm_medium: optString(e.utm_medium),
    utm_campaign: optString(e.utm_campaign),
  };
}

/**
 * Validates and normalizes an untrusted ingest payload. Returns `null` when the
 * payload is structurally invalid; otherwise returns a payload containing only
 * well-formed, safelisted, clamped events (capped at {@link MAX_EVENTS_PER_BATCH}).
 */
export function validateIngestPayload(raw: unknown, now: Date = new Date()): IngestPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const body = raw as Record<string, unknown>;

  if (typeof body.domain !== 'string' || body.domain.length === 0) return null;
  if (!Array.isArray(body.events)) return null;

  const events: ClientEvent[] = [];
  for (const candidate of body.events) {
    if (events.length >= MAX_EVENTS_PER_BATCH) break;
    const event = sanitizeEvent(candidate, now);
    if (event) events.push(event);
  }

  if (events.length === 0) return null;
  return { domain: body.domain, events };
}
