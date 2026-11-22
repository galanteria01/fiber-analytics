import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, assertProductionSecrets, checkCredentials, createToken } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: NextRequest): Promise<Response> {
  try {
    assertProductionSecrets();
  } catch {
    return NextResponse.json({ error: 'service misconfigured' }, { status: 500 });
  }
  let body: { user?: string; pass?: string };
  try {
    body = (await request.json()) as { user?: string; pass?: string };
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!body.user || !body.pass || !checkCredentials(body.user, body.pass)) {
    return NextResponse.json({ error: 'invalid credentials' }, { status: 401 });
  }

  const token = await createToken(body.user);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return response;
}
