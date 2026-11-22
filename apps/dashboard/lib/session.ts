import { createHash } from 'node:crypto';

const DEFAULT_SECRET = 'fiber-analytics-dev-secret';

/**
 * Truncates an IP address to reduce its precision before hashing: IPv4 to its
 * /24 network and IPv6 to its /48. This keeps users distinguishable enough for
 * session stitching without retaining a precise, identifying address.
 */
export function truncateIp(ip: string): string {
  if (ip.includes('.')) {
    const parts = ip.split('.');
    return `${parts[0] ?? '0'}.${parts[1] ?? '0'}.${parts[2] ?? '0'}.0`;
  }
  if (ip.includes(':')) {
    // Expand :: shorthand before truncating to avoid miscounting groups.
    const expanded = ip.includes('::') ? expandIPv6(ip) : ip;
    const groups = expanded.split(':');
    return `${groups.slice(0, 3).join(':')}::`;
  }
  return ip;
}

function expandIPv6(ip: string): string {
  const [left, right] = ip.split('::');
  const leftGroups = left ? left.split(':').filter(Boolean) : [];
  const rightGroups = right ? right.split(':').filter(Boolean) : [];
  const missing = 8 - leftGroups.length - rightGroups.length;
  return [...leftGroups, ...Array<string>(missing).fill('0'), ...rightGroups].join(':');
}

/**
 * UTC day stamp (YYYY-MM-DD) used to rotate the session secret every 24 hours.
 */
export function utcDayStamp(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Generates a cookie-less, ephemeral session identifier:
 *
 *   sha256(userAgent + truncatedIP + dailySecret)
 *
 * Because the secret incorporates the UTC day, identifiers cannot be correlated
 * across days, and no raw PII is ever stored.
 */
export function sessionHash(userAgent: string, ip: string, now = new Date()): string {
  const secret = process.env.FA_DAILY_SECRET ?? DEFAULT_SECRET;
  const dailySecret = `${secret}:${utcDayStamp(now)}`;
  return createHash('sha256')
    .update(`${userAgent}|${truncateIp(ip)}|${dailySecret}`)
    .digest('hex');
}
