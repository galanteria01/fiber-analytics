import { describe, expect, it } from 'vitest';
import { validateIngestPayload, MAX_EVENTS_PER_BATCH } from './validate.js';
import { SCHEMA_VERSION } from './schema.js';

const now = new Date('2026-06-30T12:00:00.000Z');

function event(overrides: Record<string, unknown> = {}) {
  return {
    event_id: 'e1',
    session_id: 's1',
    pageview_id: 'p1',
    seq: 1,
    occurred_at: now.toISOString(),
    event_type: 'click',
    component_name: 'Button',
    properties: { label: 'Buy' },
    url_path: '/checkout',
    ...overrides,
  };
}

describe('validateIngestPayload', () => {
  it('rejects non-object and missing fields', () => {
    expect(validateIngestPayload(null, now)).toBeNull();
    expect(validateIngestPayload({ events: [] }, now)).toBeNull();
    expect(validateIngestPayload({ domain: 'x', events: 'no' }, now)).toBeNull();
  });

  it('accepts a valid payload and defaults schema_version', () => {
    const result = validateIngestPayload({ domain: 'app.com', events: [event()] }, now);
    expect(result?.events).toHaveLength(1);
    expect(result?.events[0]?.schema_version).toBe(SCHEMA_VERSION);
  });

  it('drops events with an invalid event_type', () => {
    const result = validateIngestPayload(
      { domain: 'app.com', events: [event(), event({ event_type: 'nope' })] },
      now,
    );
    expect(result?.events).toHaveLength(1);
  });

  it('redacts sensitive props via the denylist', () => {
    const result = validateIngestPayload(
      {
        domain: 'app.com',
        events: [event({ properties: { label: 'ok', password: 'hunter2', email: 'a@b.com' } })],
      },
      now,
    );
    const props = result?.events[0]?.properties ?? {};
    expect(props).toHaveProperty('label', 'ok');
    expect(props).not.toHaveProperty('password');
    expect(props).not.toHaveProperty('email');
  });

  it('clamps far-future timestamps to now', () => {
    const result = validateIngestPayload(
      { domain: 'app.com', events: [event({ occurred_at: '2999-01-01T00:00:00.000Z' })] },
      now,
    );
    expect(result?.events[0]?.occurred_at).toBe(now.toISOString());
  });

  it('caps the number of events per batch', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 50 }, () => event());
    const result = validateIngestPayload({ domain: 'app.com', events }, now);
    expect(result?.events.length).toBe(MAX_EVENTS_PER_BATCH);
  });
});
