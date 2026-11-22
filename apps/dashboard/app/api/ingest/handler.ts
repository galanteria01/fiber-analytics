import { clampTimestamp, validateIngestPayload, type AnalyticsEvent } from '@fiber-analytics/core';
import { sessionHash } from '@/lib/session';
import { getConfig, isAllowed } from '@/lib/config';
import { rateLimit } from '@/lib/ratelimit';

const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|wget|curl|python-requests/i;

export interface IngestRequest {
  headers: Record<string, string | null>;
  bodyText: string;
}

export interface IngestResult {
  status: number;
  error?: string;
  domain?: string;
  enriched?: AnalyticsEvent[];
}

export function buildCorsHeaders(origin: string | null): Record<string, string> {
  const { allowedOrigins } = getConfig();
  const allowOrigin = isAllowed(allowedOrigins, origin) ? (origin ?? '*') : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

export function handleIngestRequest(req: IngestRequest, now = new Date()): IngestResult {
  const config = getConfig();
  const origin = req.headers.origin ?? null;

  const contentType = req.headers['content-type'] ?? null;
  if (contentType && !contentType.includes('application/json')) {
    return { status: 415, error: 'unsupported content type' };
  }

  if (!isAllowed(config.allowedOrigins, origin)) {
    return { status: 403, error: 'origin not allowed' };
  }

  const userAgent = req.headers['user-agent'] ?? 'unknown';
  if (BOT_UA.test(userAgent)) {
    return { status: 204 };
  }

  const ipHeader =
    req.headers[config.proxyIpHeader.toLowerCase()] ?? req.headers['x-real-ip'] ?? null;
  const ip = ipHeader ? ipHeader.split(',')[0]!.trim() : '0.0.0.0';
  if (!rateLimit(ip, config.rateLimitPerMinute)) {
    return { status: 429, error: 'rate limited' };
  }

  const declaredLen = parseInt(req.headers['content-length'] ?? '0', 10);
  if (Number.isFinite(declaredLen) && declaredLen > config.maxBodyBytes) {
    return { status: 413, error: 'payload too large' };
  }
  if (req.bodyText.length > config.maxBodyBytes) {
    return { status: 413, error: 'payload too large' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(req.bodyText);
  } catch {
    return { status: 400, error: 'invalid json' };
  }

  const payload = validateIngestPayload(raw, now, config.maxEventsPerBatch);
  if (!payload) {
    return { status: 400, error: 'invalid payload' };
  }

  if (!isAllowed(config.allowedDomains, payload.domain)) {
    return { status: 403, error: 'domain not allowed' };
  }

  const hash = sessionHash(userAgent, ip, now);
  const serverTime = now.toISOString();
  const enriched: AnalyticsEvent[] = payload.events.map((event) => ({
    ...event,
    session_hash: hash,
    occurred_at: clampTimestamp(event.occurred_at, now),
    timestamp: serverTime,
  }));

  return { status: 204, domain: payload.domain, enriched };
}
