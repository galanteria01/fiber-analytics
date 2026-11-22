import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IngestConfig } from '@/lib/config';

// Mock heavy deps before importing handler.
vi.mock('@/lib/buffer', () => ({ bufferEvents: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
import * as configMod from '@/lib/config';
import { handleIngestRequest, buildCorsHeaders } from './handler';
import { pruneRateLimiter } from '@/lib/ratelimit';

const FIXED_NOW = new Date('2026-06-30T12:00:00.000Z');

function validPayload(domain = 'example.com', count = 1) {
  return {
    domain,
    events: Array.from({ length: count }, (_, i) => ({
      event_type: 'click' as const,
      url_path: `/page-${i}`,
      component_name: 'Button',
      event_id: `evt-${i}`,
      session_id: 'sess-1',
      pageview_id: 'pv-1',
      seq: i,
      occurred_at: FIXED_NOW.toISOString(),
      properties: { label: 'ok' },
    })),
  };
}

function headers(overrides: Record<string, string | null> = {}): Record<string, string | null> {
  return {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0',
    origin: null,
    'x-real-ip': '203.0.113.1',
    'content-length': null,
    ...overrides,
  };
}

beforeEach(() => {
  pruneRateLimiter(Date.now() + 120_000);
});

describe('handleIngestRequest', () => {
  it('happy path returns 204 with enriched events', () => {
    const result = handleIngestRequest(
      { headers: headers(), bodyText: JSON.stringify(validPayload()) },
      FIXED_NOW,
    );
    expect(result.status).toBe(204);
    expect(result.error).toBeUndefined();
    expect(result.domain).toBe('example.com');
    expect(result.enriched).toHaveLength(1);
    expect(result.enriched![0]!.session_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.enriched![0]!.timestamp).toBe(FIXED_NOW.toISOString());
  });

  it('rejects non-JSON content-type with 415', () => {
    const result = handleIngestRequest(
      { headers: headers({ 'content-type': 'text/plain' }), bodyText: '{}' },
      FIXED_NOW,
    );
    expect(result.status).toBe(415);
    expect(result.error).toBe('unsupported content type');
  });

  it('allows missing content-type (sendBeacon compat)', () => {
    const result = handleIngestRequest(
      { headers: headers({ 'content-type': null }), bodyText: JSON.stringify(validPayload()) },
      FIXED_NOW,
    );
    expect(result.status).toBe(204);
  });

  it('returns 204 for bot user-agent without processing', () => {
    const result = handleIngestRequest(
      {
        headers: headers({ 'user-agent': 'Googlebot/2.1' }),
        bodyText: JSON.stringify(validPayload()),
      },
      FIXED_NOW,
    );
    expect(result.status).toBe(204);
    expect(result.enriched).toBeUndefined();
  });

  it('returns 413 when declared content-length exceeds maxBodyBytes', () => {
    const big = String(512 * 1024);
    const result = handleIngestRequest(
      { headers: headers({ 'content-length': big }), bodyText: '{}' },
      FIXED_NOW,
    );
    expect(result.status).toBe(413);
  });

  it('returns 413 when actual body length exceeds maxBodyBytes', () => {
    const bigBody = 'x'.repeat(300 * 1024);
    const result = handleIngestRequest(
      { headers: headers({ 'content-length': null }), bodyText: bigBody },
      FIXED_NOW,
    );
    expect(result.status).toBe(413);
  });

  it('returns 400 for invalid JSON', () => {
    const result = handleIngestRequest({ headers: headers(), bodyText: '{ not json' }, FIXED_NOW);
    expect(result.status).toBe(400);
    expect(result.error).toBe('invalid json');
  });

  it('returns 400 for invalid payload (missing domain)', () => {
    const result = handleIngestRequest(
      { headers: headers(), bodyText: JSON.stringify({ events: [] }) },
      FIXED_NOW,
    );
    expect(result.status).toBe(400);
    expect(result.error).toBe('invalid payload');
  });

  it('respects maxEvents cap from validateIngestPayload', () => {
    const orig = configMod.getConfig();
    const fakeConfig: IngestConfig = { ...orig, maxEventsPerBatch: 3 };
    vi.spyOn(configMod, 'getConfig').mockReturnValue(fakeConfig);

    const result = handleIngestRequest(
      {
        headers: headers({ 'content-length': null, 'x-real-ip': '198.51.100.1' }),
        bodyText: JSON.stringify(validPayload('example.com', 10)),
      },
      FIXED_NOW,
    );
    expect(result.enriched).toHaveLength(3);

    vi.mocked(configMod.getConfig).mockRestore();
  });

  it('rate limits repeated requests from same IP', () => {
    const ip = '192.0.2.99';
    const h = headers({ 'x-real-ip': ip, 'content-length': null });
    const orig = configMod.getConfig();
    const fakeConfig: IngestConfig = { ...orig, rateLimitPerMinute: 2 };
    vi.spyOn(configMod, 'getConfig').mockReturnValue(fakeConfig);

    expect(
      handleIngestRequest({ headers: h, bodyText: JSON.stringify(validPayload()) }, FIXED_NOW)
        .status,
    ).toBe(204);
    expect(
      handleIngestRequest({ headers: h, bodyText: JSON.stringify(validPayload()) }, FIXED_NOW)
        .status,
    ).toBe(204);
    expect(
      handleIngestRequest({ headers: h, bodyText: JSON.stringify(validPayload()) }, FIXED_NOW)
        .status,
    ).toBe(429);

    vi.mocked(configMod.getConfig).mockRestore();
    pruneRateLimiter(Date.now() + 120_000);
  });
});

describe('buildCorsHeaders', () => {
  it('returns allowlist-aware CORS headers', () => {
    const h = buildCorsHeaders('https://example.com');
    expect(h['Access-Control-Allow-Methods']).toBe('POST, OPTIONS');
    expect(h['Access-Control-Allow-Headers']).toBe('content-type');
    expect(h.Vary).toBe('Origin');
  });
});
