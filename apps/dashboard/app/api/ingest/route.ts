import { NextResponse, type NextRequest } from 'next/server';
import { validateIngestPayload, type AnalyticsEvent } from '@fiber-analytics/core';
import { sessionHash } from '@/lib/session';
import { bufferEvents } from '@/lib/buffer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? '0.0.0.0';
  return request.headers.get('x-real-ip') ?? '0.0.0.0';
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest): Promise<Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400, headers: CORS_HEADERS });
  }

  const payload = validateIngestPayload(raw);
  if (!payload) {
    return NextResponse.json({ error: 'invalid payload' }, { status: 400, headers: CORS_HEADERS });
  }

  // Stitch an ephemeral, cookie-less session id and stamp an authoritative
  // server timestamp before persisting.
  const userAgent = request.headers.get('user-agent') ?? 'unknown';
  const hash = sessionHash(userAgent, clientIp(request));
  const serverTime = new Date().toISOString();

  const enriched: AnalyticsEvent[] = payload.events.map((event) => ({
    ...event,
    session_hash: hash,
    timestamp: event.timestamp || serverTime,
  }));

  await bufferEvents(payload.domain, enriched);

  // 204: fast, body-less acknowledgement suited to sendBeacon.
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
