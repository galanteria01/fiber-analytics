import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionManager } from './session.js';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('SessionManager', () => {
  it('generates a stable session id across reads', () => {
    const mgr = new SessionManager();
    expect(mgr.sessionId).toBe(mgr.sessionId);
  });

  it('increments seq monotonically', () => {
    const mgr = new SessionManager();
    expect(mgr.nextSeq()).toBe(1);
    expect(mgr.nextSeq()).toBe(2);
    expect(mgr.nextSeq()).toBe(3);
  });

  it('persists the session across instances (same tab)', () => {
    const a = new SessionManager();
    const id = a.sessionId;
    const b = new SessionManager();
    expect(b.sessionId).toBe(id);
  });

  it('rotates the session id after the inactivity window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-30T12:00:00Z'));
    const a = new SessionManager(1000);
    const first = a.sessionId;
    vi.setSystemTime(new Date('2026-06-30T12:00:05Z'));
    const b = new SessionManager(1000);
    expect(b.sessionId).not.toBe(first);
  });
});
