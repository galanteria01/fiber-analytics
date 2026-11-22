import { beforeEach, describe, expect, it } from 'vitest';
import { handleIngestRequest } from './handler.js';

function validBody(domain = 'example.com', eventCount = 1) {
  const events = Array.from({ length: eventCount }, (_, i) => ({
    event_id: `e-${i}`,
    session_id: `s-${i}`,
    pageview_id: `p-${i}`,
    seq: i,
    occurred_at: new Date().toISOString(),
    event_type: 'click',
    url_path: '/test',
  }));
  return JSON.stringify({ domain, events });
}

function req(overrides: Record<string, unknown> = {}): Parameters<typeof handleIngestRequest>[0] {
  return {
    headers: {
      'content-type': 'application/json',
      'user-agent': 'Mozilla/5.0',
      ...(overrides.headers as Record<string, string> | undefined),
    },
    bodyText: (overrides.bodyText as string) ?? validBody(),
  };
}

describe('handleIngestRequest', () => {
  beforeEach(() => {
    delete process.env.FA_ALLOWED_ORIGINS;
    delete process.env.FA_ALLOWED_DOMAINS;
  });

  it('returns 204 with enriched events on happy path', () => {
    const result = handleIngestRequest(req());
    expect(result.status).toBe(204);
    expect(result.enriched).toBeDefined();
    expect(result.enriched!.length).toBe(1);
    expect(result.enriched![0]!.session_hash).toBeDefined();
    expect(result.enriched![0]!.timestamp).toBeDefined();
  });

  it('rejects unsupported content-type with 415', () => {
    const result = handleIngestRequest(req({ headers: { 'content-type': 'text/plain' } }));
    expect(result.status).toBe(415);
  });

  it('allows missing content-type (sendBeacon compat)', () => {
    const result = handleIngestRequest({
      headers: { 'user-agent': 'Mozilla/5.0' },
      bodyText: validBody(),
    });
    expect(result.status).toBe(204);
  });

  it('returns 400 on invalid json', () => {
    const result = handleIngestRequest(req({ bodyText: 'not-json' }));
    expect(result.status).toBe(400);
    expect(result.error).toBe('invalid json');
  });

  it('returns 400 on invalid payload (missing domain)', () => {
    const result = handleIngestRequest(req({ bodyText: JSON.stringify({ events: [] }) }));
    expect(result.status).toBe(400);
  });

  it('returns 204 for bot user-agents (no enrichment)', () => {
    const result = handleIngestRequest(
      req({ headers: { 'user-agent': 'Googlebot/2.1', 'content-type': 'application/json' } }),
    );
    expect(result.status).toBe(204);
    expect(result.enriched).toBeUndefined();
  });

  it('caps events at maxEventsPerBatch', () => {
    // default is 500
    const result = handleIngestRequest(req({ bodyText: validBody('example.com', 10) }));
    expect(result.status).toBe(204);
    expect(result.enriched!.length).toBeLessThanOrEqual(500);
  });

  it('attaches server session_hash and timestamps', () => {
    const now = new Date('2026-05-01T12:00:00Z');
    const result = handleIngestRequest(req(), now);
    expect(result.enriched![0]!.session_hash.length).toBe(64); // sha256 hex
    expect(result.enriched![0]!.timestamp).toBe(now.toISOString());
  });
});
