import { NextResponse, type NextRequest } from 'next/server';
import { validateIngestPayload, clampTimestamp, type AnalyticsEvent } from '@fiber-analytics/core';
import { sessionHash } from '@/lib/session';
import { bufferEvents } from '@/lib/buffer';
import { getConfig, isAllowed } from '@/lib/config';
import { rateLimit } from '@/lib/ratelimit';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BOT_UA = /bot|crawl|spider|slurp|headless|preview|monitor|wget|curl|python-requests/i;

function corsHeaders(origin: string | null): Record<string, string> {
  const { allowedOrigins } = getConfig();
  const allowOrigin = isAllowed(allowedOrigins, origin) ? (origin ?? '*') : 'null';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

function clientIp(request: NextRequest): string {
  const header = request.headers.get(getConfig().proxyIpHeader);
  if (header) return header.split(',')[0]?.trim() ?? '0.0.0.0';
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function OPTIONS(request: NextRequest): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get('origin')) });
}

export async function POST(request: NextRequest): Promise<Response> {
  const config = getConfig();
  const origin = request.headers.get('origin');
  const headers = corsHeaders(origin);

  // 1. Origin allowlist (when configured).
  if (!isAllowed(config.allowedOrigins, origin)) {
    logger.warn('ingest rejected: origin', { origin });
    return NextResponse.json({ error: 'origin not allowed' }, { status: 403, headers });
  }

  // 2. Bot filtering.
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  if (BOT_UA.test(userAgent)) {
    return new Response(null, { status: 204, headers });
  }

  // 3. Per-IP rate limit.
  const ip = clientIp(request);
  if (!rateLimit(ip, config.rateLimitPerMinute)) {
    return NextResponse.json({ error: 'rate limited' }, { status: 429, headers });
  }

  // 4. Body-size cap (declared length, then actual).
  const declared = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(declared) && declared > config.maxBodyBytes) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413, headers });
  }

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400, headers });
  }
  if (bodyText.length > config.maxBodyBytes) {
    return NextResponse.json({ error: 'payload too large' }, { status: 413, headers });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers });
  }

  // 5. Schema validation, prop denylist, and timestamp clamping.
  const now = new Date();
  const payload = validateIngestPayload(raw, now);
  if (!payload) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400, headers });
  }

  // 6. Domain allowlist (when configured).
  if (!isAllowed(config.allowedDomains, payload.domain)) {
    return NextResponse.json({ error: 'domain not allowed' }, { status: 403, headers });
  }

  // 7. Enrich: server-derived session hash + authoritative server timestamp.
  const hash = sessionHash(userAgent, ip, now);
  const serverTime = now.toISOString();
  const enriched: AnalyticsEvent[] = payload.events.map((event) => ({
    ...event,
    session_hash: hash,
    occurred_at: clampTimestamp(event.occurred_at, now),
    timestamp: serverTime,
  }));

  try {
    await bufferEvents(payload.domain, enriched);
  } catch (error) {
    logger.error('ingest write failed', { error: String(error) });
    return NextResponse.json({ error: 'storage error' }, { status: 502, headers });
  }

  logger.debug('ingest ok', { domain: payload.domain, count: enriched.length });
  // 204: fast, body-less acknowledgement suited to sendBeacon.
  return new Response(null, { status: 204, headers });
}
