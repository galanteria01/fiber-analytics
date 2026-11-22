import { timingSafeEqual } from 'node:crypto';

/**
 * Minimal, edge-compatible session auth using a signed (HMAC-SHA256) cookie.
 * It protects all dashboard pages behind a credentials login. This is
 * intentionally dependency-free and can be swapped for Auth.js/NextAuth by
 * replacing this module + the middleware while keeping the same cookie gate.
 *
 * Auth is disabled automatically when no `FA_DASHBOARD_PASSWORD` is set (local
 * dev convenience) or when `FA_AUTH_DISABLED=true`.
 */
export const AUTH_COOKIE = 'fa_session';

function secret(): string {
  return process.env.FA_AUTH_SECRET ?? 'fiber-analytics-dev-auth-secret';
}

export function authDisabled(): boolean {
  if (process.env.FA_AUTH_DISABLED === 'true') return true;
  return !process.env.FA_DASHBOARD_PASSWORD;
}

const DEV_DEFAULT_SECRET = 'fiber-analytics-dev-auth-secret';

export function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.FA_DASHBOARD_PASSWORD) return;
  const secretValue = process.env.FA_AUTH_SECRET;
  if (!secretValue || secretValue === DEV_DEFAULT_SECRET) {
    throw new Error(
      'FA_AUTH_SECRET must be set to a non-default value in production when FA_DASHBOARD_PASSWORD is set',
    );
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

async function sign(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToBase64(new Uint8Array(sig));
}

/** Mints a signed token `base64(user:exp).sig` valid for `ttlMs`. */
export async function createToken(user: string, ttlMs = 7 * 24 * 60 * 60 * 1000): Promise<string> {
  const payload = `${user}:${Date.now() + ttlMs}`;
  return `${btoa(payload)}.${await sign(payload)}`;
}

/** Verifies a token's signature and expiry. */
export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return false;
  let payload: string;
  try {
    payload = atob(b64);
  } catch {
    return false;
  }
  const expectedSig = await sign(payload);
  const a = Buffer.from(expectedSig, 'utf8');
  const b = Buffer.from(sig, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const exp = Number(payload.split(':')[1]);
  return Number.isFinite(exp) && Date.now() < exp;
}

/** Timing-safe credential check against configured env credentials. */
export function checkCredentials(user: string, pass: string): boolean {
  const expectedUser = process.env.FA_DASHBOARD_USER ?? 'admin';
  const expectedPass = process.env.FA_DASHBOARD_PASSWORD;
  if (!expectedPass) return false;
  const userBuf = Buffer.from(user, 'utf8');
  const expectedUserBuf = Buffer.from(expectedUser, 'utf8');
  const passBuf = Buffer.from(pass, 'utf8');
  const expectedPassBuf = Buffer.from(expectedPass, 'utf8');
  // timingSafeEqual requires equal-length buffers; mismatch means credentials differ,
  // but we still run a dummy comparison to avoid leaking length via timing.
  const userMatch =
    userBuf.length === expectedUserBuf.length && timingSafeEqual(userBuf, expectedUserBuf);
  const passMatch =
    passBuf.length === expectedPassBuf.length && timingSafeEqual(passBuf, expectedPassBuf);
  return userMatch && passMatch;
}
