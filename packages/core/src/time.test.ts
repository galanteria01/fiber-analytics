import { describe, expect, it } from 'vitest';
import { clampTimestamp } from './time.js';

const now = new Date('2026-06-30T12:00:00.000Z');

describe('clampTimestamp', () => {
  it('keeps a valid in-window timestamp', () => {
    const iso = '2026-06-30T11:59:00.000Z';
    expect(clampTimestamp(iso, now)).toBe(iso);
  });

  it('replaces a far-future timestamp with now', () => {
    expect(clampTimestamp('2999-01-01T00:00:00.000Z', now)).toBe(now.toISOString());
  });

  it('replaces a very old timestamp with now', () => {
    expect(clampTimestamp('2000-01-01T00:00:00.000Z', now)).toBe(now.toISOString());
  });

  it('replaces invalid / non-string input with now', () => {
    expect(clampTimestamp('not-a-date', now)).toBe(now.toISOString());
    expect(clampTimestamp(undefined, now)).toBe(now.toISOString());
    expect(clampTimestamp(12345, now)).toBe(now.toISOString());
  });
});
