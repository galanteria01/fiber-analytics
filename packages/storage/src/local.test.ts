import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalObjectStore } from './local.js';

let root: string;
let store: LocalObjectStore;

beforeEach(async () => {
  root = await mkdtemp(path.join(os.tmpdir(), 'fa-store-'));
  store = new LocalObjectStore(root);
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('LocalObjectStore', () => {
  it('puts and gets an object', async () => {
    await store.put('raw/a.ndjson', 'hello');
    expect(await store.get('raw/a.ndjson')).toBe('hello');
  });

  it('lists keys recursively under a prefix', async () => {
    await store.put('raw/a.ndjson', '1');
    await store.put('raw/sub/b.ndjson', '2');
    await store.put('analytics/x.parquet', '3');
    const raw = await store.list('raw');
    expect(raw.sort()).toEqual(['raw/a.ndjson', 'raw/sub/b.ndjson']);
  });

  it('moves an object', async () => {
    await store.put('raw/a.ndjson', 'x');
    await store.move('raw/a.ndjson', 'processing/a.ndjson');
    expect(await store.list('raw')).toHaveLength(0);
    expect(await store.get('processing/a.ndjson')).toBe('x');
  });

  it('deletes objects (ignoring missing)', async () => {
    await store.put('raw/a.ndjson', 'x');
    await store.delete(['raw/a.ndjson', 'raw/missing.ndjson']);
    expect(await store.list('raw')).toHaveLength(0);
  });

  it('builds posix uris and globs and needs no duckdb setup', () => {
    expect(store.uri('analytics/x.parquet')).toContain('/analytics/x.parquet');
    expect(store.glob('analytics', '*.parquet')).toContain('/analytics/**/*.parquet');
    expect(store.duckdbSetup()).toEqual([]);
  });
});
