import { describe, expect, it } from 'vitest';
import { formatDateTime, humanizeDuration, relativeTime } from './format';

describe('humanizeDuration', () => {
  it('formats sub-second, seconds, minutes and hours', () => {
    expect(humanizeDuration(500)).toBe('500ms');
    expect(humanizeDuration(5000)).toBe('5s');
    expect(humanizeDuration(65_000)).toBe('1m 5s');
    expect(humanizeDuration(3_600_000)).toBe('1h');
    expect(humanizeDuration(3_780_000)).toBe('1h 3m');
  });
  it('clamps negatives', () => {
    expect(humanizeDuration(-10)).toBe('0s');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-06-30T12:00:00Z');
  it('reports recent and elapsed times', () => {
    expect(relativeTime('2026-06-30T11:59:30Z', now)).toBe('just now');
    expect(relativeTime('2026-06-30T11:55:00Z', now)).toBe('5m ago');
    expect(relativeTime('2026-06-30T09:00:00Z', now)).toBe('3h ago');
    expect(relativeTime('2026-06-27T12:00:00Z', now)).toBe('3d ago');
  });
});

describe('formatDateTime', () => {
  it('renders a stable UTC timestamp', () => {
    expect(formatDateTime('2026-06-30T12:34:56.000Z')).toBe('2026-06-30 12:34:56');
  });
});
