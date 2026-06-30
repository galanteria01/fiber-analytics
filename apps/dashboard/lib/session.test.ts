import { describe, expect, it } from 'vitest';
import { sessionHash, truncateIp, utcDayStamp } from './session';

describe('truncateIp', () => {
  it('truncates IPv4 to /24', () => {
    expect(truncateIp('203.0.113.42')).toBe('203.0.113.0');
  });
  it('truncates IPv6 to /48', () => {
    expect(truncateIp('2001:db8:abcd:1234::1')).toBe('2001:db8:abcd::');
  });
});

describe('sessionHash', () => {
  const now = new Date('2026-06-30T12:00:00Z');

  it('is deterministic for the same inputs and day', () => {
    const a = sessionHash('UA', '203.0.113.42', now);
    const b = sessionHash('UA', '203.0.113.99', now); // same /24
    expect(a).toBe(b);
  });

  it('differs across days', () => {
    const a = sessionHash('UA', '203.0.113.42', new Date('2026-06-30T23:59:59Z'));
    const b = sessionHash('UA', '203.0.113.42', new Date('2026-07-01T00:00:01Z'));
    expect(a).not.toBe(b);
  });

  it('differs for different user agents', () => {
    expect(sessionHash('A', '203.0.113.1', now)).not.toBe(sessionHash('B', '203.0.113.1', now));
  });

  it('produces a UTC day stamp', () => {
    expect(utcDayStamp(now)).toBe('2026-06-30');
  });
});
