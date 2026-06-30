import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Transport } from './transport.js';
import type { ClientEvent } from '@fiber-analytics/core';

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

function makeEvent(i: number): ClientEvent {
  return {
    schema_version: 2,
    event_id: `e${i}`,
    session_id: 's',
    pageview_id: 'p',
    seq: i,
    occurred_at: new Date().toISOString(),
    event_type: 'click',
    component_name: 'Button',
    properties: { i },
    url_path: '/',
  };
}

let store: Storage;

beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Transport.send', () => {
  it('does not spill on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    const t = new Transport({ endpoint: '/i', domain: 'app', maxRetries: 0 });
    await t.send([makeEvent(1)]);
    expect(store.getItem('fa_spillover')).toBeNull();
  });

  it('spills to localStorage after exhausting retries', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const t = new Transport({ endpoint: '/i', domain: 'app', maxRetries: 0 });
    await t.send([makeEvent(1), makeEvent(2)]);
    const spilled = JSON.parse(store.getItem('fa_spillover') ?? '[]') as ClientEvent[];
    expect(spilled).toHaveLength(2);
  });

  it('does not retry on non-retryable 4xx', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 400 });
    vi.stubGlobal('fetch', fetchMock);
    const t = new Transport({ endpoint: '/i', domain: 'app', maxRetries: 3 });
    await t.send([makeEvent(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem('fa_spillover')).toBeNull();
  });

  it('flushSpillover re-sends and clears stored events', async () => {
    store.setItem('fa_spillover', JSON.stringify([makeEvent(1)]));
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204 });
    vi.stubGlobal('fetch', fetchMock);
    const t = new Transport({ endpoint: '/i', domain: 'app', maxRetries: 0 });
    await t.flushSpillover();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(store.getItem('fa_spillover')).toBeNull();
  });
});

describe('Transport.sendBeacon', () => {
  it('chunks large bursts into multiple beacons', () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { sendBeacon: beacon });
    const t = new Transport({ endpoint: '/i', domain: 'app', maxRetries: 0 });
    // Each event serializes to well over 60 bytes; 4000 events forces chunking.
    const events = Array.from({ length: 4000 }, (_, i) => makeEvent(i));
    t.sendBeacon(events);
    expect(beacon.mock.calls.length).toBeGreaterThan(1);
  });
});
