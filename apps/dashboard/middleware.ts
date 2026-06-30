import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, authDisabled, verifyToken } from '@/lib/auth';

/**
 * Gates all dashboard pages behind the session cookie. The ingestion endpoint,
 * auth routes, the login page, and static assets are excluded via the matcher.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  if (authDisabled()) return NextResponse.next();

  const token = request.cookies.get(AUTH_COOKIE)?.value;
  if (await verifyToken(token)) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|login).*)'],
};
