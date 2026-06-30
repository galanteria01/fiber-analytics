function csv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function int(value: string | undefined, fallback: number): number {
  const n = value ? Number.parseInt(value, 10) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Server-side ingestion configuration, resolved once from the environment.
 * Empty allowlists mean "allow all" (convenient for local dev); set them in
 * production to lock ingestion down to known origins/domains.
 */
export interface IngestConfig {
  allowedOrigins: string[];
  allowedDomains: string[];
  maxBodyBytes: number;
  maxEventsPerBatch: number;
  rateLimitPerMinute: number;
  proxyIpHeader: string;
  dailySecret: string;
  retentionDays: number;
}

let cached: IngestConfig | null = null;

export function getConfig(): IngestConfig {
  if (cached) return cached;
  cached = {
    allowedOrigins: csv(process.env.FA_ALLOWED_ORIGINS),
    allowedDomains: csv(process.env.FA_ALLOWED_DOMAINS),
    maxBodyBytes: int(process.env.FA_MAX_BODY_BYTES, 256 * 1024),
    maxEventsPerBatch: int(process.env.FA_MAX_EVENTS, 500),
    rateLimitPerMinute: int(process.env.FA_RATE_LIMIT_RPM, 600),
    proxyIpHeader: process.env.FA_IP_HEADER ?? 'x-forwarded-for',
    dailySecret: process.env.FA_DAILY_SECRET ?? 'fiber-analytics-dev-secret',
    retentionDays: int(process.env.FA_RETENTION_DAYS, 90),
  };
  return cached;
}

/** True when an allowlist is empty (allow-all) or contains the candidate. */
export function isAllowed(allowlist: string[], candidate: string | null): boolean {
  if (allowlist.length === 0) return true;
  if (!candidate) return false;
  return allowlist.includes(candidate);
}
