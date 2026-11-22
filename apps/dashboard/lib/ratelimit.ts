interface Bucket {
  count: number;
  resetAt: number;
}

const WINDOW_MS = 60_000;
const buckets = new Map<string, Bucket>();

/**
 * A lightweight fixed-window per-key rate limiter held in process memory.
 * Suitable for a single ingestion instance; front a shared store (Redis) for
 * multi-instance deployments. Returns whether the request is allowed.
 */
export function rateLimit(key: string, limitPerMinute: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    if (buckets.size > 10_000) pruneRateLimiter(now);
    return true;
  }
  if (bucket.count >= limitPerMinute) return false;
  bucket.count += 1;
  return true;
}

/** Periodically evicts expired buckets to bound memory. */
export function pruneRateLimiter(now: number = Date.now()): void {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}
