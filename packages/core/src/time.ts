/** Reject timestamps more than this far in the future (clock skew tolerance). */
export const MAX_FUTURE_MS = 5 * 60 * 1000;

/** Reject timestamps older than this (avoids back-dating / partition poisoning). */
export const MAX_PAST_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Validates and clamps an untrusted ISO timestamp. Returns a safe ISO string:
 * the original when it parses and falls within the accepted window, otherwise
 * the provided `now`. This prevents clients from poisoning date partitions with
 * far-future or ancient timestamps.
 */
export function clampTimestamp(value: unknown, now: Date = new Date()): string {
  const nowMs = now.getTime();
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    if (!Number.isNaN(ms) && ms <= nowMs + MAX_FUTURE_MS && ms >= nowMs - MAX_PAST_MS) {
      return new Date(ms).toISOString();
    }
  }
  return now.toISOString();
}
