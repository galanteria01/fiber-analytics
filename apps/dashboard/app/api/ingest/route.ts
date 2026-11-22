import { NextResponse, type NextRequest } from 'next/server';
import { bufferEvents } from '@/lib/buffer';
import { logger } from '@/lib/logger';
import { buildCorsHeaders, handleIngestRequest } from './handler';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function headersToRecord(headers: Headers): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  for (const [key, value] of headers.entries()) out[key] = value;
  return out;
}

export function OPTIONS(request: NextRequest): Response {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request.headers.get('origin')),
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  const origin = request.headers.get('origin');
  const cors = buildCorsHeaders(origin);

  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400, headers: cors });
  }

  const result = handleIngestRequest({ headers: headersToRecord(request.headers), bodyText });

  if (result.status !== 204 || result.error) {
    return NextResponse.json(
      { error: result.error ?? 'unknown' },
      { status: result.status, headers: cors },
    );
  }

  // Bot requests return 204 without enriched data; acknowledge immediately.
  if (!result.enriched) {
    return new Response(null, { status: 204, headers: cors });
  }

  try {
    await bufferEvents(result.domain!, result.enriched);
  } catch (error) {
    logger.error('ingest write failed', { error: String(error) });
    return NextResponse.json({ error: 'storage error' }, { status: 502, headers: cors });
  }

  logger.debug('ingest ok', { domain: result.domain, count: result.enriched.length });
  return new Response(null, { status: 204, headers: cors });
}
