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
  if ((await sign(payload)) !== sig) return false;
  const exp = Number(payload.split(':')[1]);
  return Number.isFinite(exp) && Date.now() < exp;
}

/** Constant-ish credential check against configured env credentials. */
export function checkCredentials(user: string, pass: string): boolean {
  const expectedUser = process.env.FA_DASHBOARD_USER ?? 'admin';
  const expectedPass = process.env.FA_DASHBOARD_PASSWORD;
  return Boolean(expectedPass) && user === expectedUser && pass === expectedPass;
}
