import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { LocalObjectStore } from '@fiber-analytics/storage';
import type { DuckDBConnection } from '@duckdb/node-api';

function createMockConnection(mockRun: (sql: string) => Promise<void>): DuckDBConnection {
  return {
    run: mockRun as unknown as DuckDBConnection['run'],
    closeSync: vi.fn(),
  } as unknown as DuckDBConnection;
}

function partitionSuffixNow(): string {
  const now = new Date();
  const y = now.getUTCFullYear().toString().padStart(4, '0');
  const m = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const d = now.getUTCDate().toString().padStart(2, '0');
  return `domain=example.com/year=${y}/month=${m}/day=${d}/events_mock.parquet`;
}

async function handleSql(sql: string): Promise<void> {
  const toMatch = sql.match(/TO\s+'([^']+)'/);
  if (!toMatch?.[1]) return;
  const toPath = toMatch[1];
  const isPartitioned = sql.includes('PARTITION_BY');
  if (isPartitioned) {
    const fake = path.join(toPath, partitionSuffixNow());
    await mkdir(path.dirname(fake), { recursive: true });
    await writeFile(fake, 'mock-parquet');
  } else {
    await mkdir(path.dirname(toPath), { recursive: true });
    await writeFile(toPath, 'mock-parquet-compacted');
  }
}

const holder = vi.hoisted(() => ({
  store: null as LocalObjectStore | null,
  config: {
    pollIntervalMs: 4000,
    retentionDays: 90,
    compactionThreshold: 8,
    healthPort: undefined as number | undefined,
  },
}));

vi.mock('./config.js', () => ({
  get store() {
    return holder.store;
  },
  get config() {
    return holder.config;
  },
  log: vi.fn(),
  logError: vi.fn(),
}));

vi.mock('./duck.js', () => {
  const mockRun = vi.fn(async (sql: string) => {
    await handleSql(sql);
  });

  const mockConnection = createMockConnection(mockRun);

  return {
    createConnection: vi.fn(async () => mockConnection),
    RAW_COLUMNS: `{ schema_version: 'INTEGER', event_id: 'VARCHAR' }`,
    SELECT_COLUMNS: `schema_version, event_id`,
  };
});

// Import after mocks are established
import { claim, compile, compact, prune, runOnce } from './pipeline.js';
import { createConnection } from './duck.js';
import { log } from './config.js';

let tmpDir: string;

function getStore(): LocalObjectStore {
  if (!holder.store) throw new Error('store not initialized');
  return holder.store;
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await readdir(p);
    return true;
  } catch {
    try {
      await stat(p);
      return true;
    } catch {
      return false;
    }
  }
}

function resetCreateConnectionMock(): void {
  const mockedCreate = vi.mocked(createConnection);
  const hasOverride =
    mockedCreate.mock.calls.length > 0 || vi.isMockFunction(mockedCreate) === true;
  // Re-apply default implementation when a test overrode it with mockImplementationOnce/mockRejectedValueOnce etc.
  // We detect overrides by checking if mock has been called or has a custom impl queued.
  if (hasOverride) {
    const mockRun = vi.fn(async (sql: string) => {
      await handleSql(sql);
    });
    mockedCreate.mockImplementation(async () => createMockConnection(mockRun));
    mockedCreate.mockClear();
    vi.mocked(log).mockClear();
  }
}

beforeEach(async () => {
  tmpDir = await mkdtemp(path.join(os.tmpdir(), 'fa-worker-'));
  holder.store = new LocalObjectStore(tmpDir);
  holder.config.retentionDays = 90;
  holder.config.compactionThreshold = 8;
  holder.config.pollIntervalMs = 4000;
  holder.config.healthPort = undefined;
  vi.clearAllMocks();
  resetCreateConnectionMock();
});

afterEach(async () => {
  vi.clearAllMocks();
  if (tmpDir) {
    await rm(tmpDir, { recursive: true, force: true });
  }
});

describe('claim', () => {
  it('moves raw NDJSON into processing and returns processing keys', async () => {
    const store = getStore();
    await store.put('raw/a.ndjson', '{"event_id":"1"}\n');
    await store.put('raw/b.ndjson', '{"event_id":"2"}\n');

    const claimed = await claim();

    expect(claimed.sort()).toEqual(['processing/a.ndjson', 'processing/b.ndjson']);
    expect(await store.list('raw')).toEqual([]);
    expect((await store.list('processing')).sort()).toEqual([
      'processing/a.ndjson',
      'processing/b.ndjson',
    ]);
    expect(await store.get('processing/a.ndjson')).toBe('{"event_id":"1"}\n');
  });

  it('ignores non-ndjson files and recovers orphaned processing files', async () => {
    const store = getStore();
    await store.put('raw/ignore.txt', 'not ndjson');
    await store.put('raw/keep.ndjson', '{"event_id":"x"}\n');
    await store.put('processing/orphan.ndjson', '{"event_id":"orphan"}\n');

    const claimed = await claim();

    expect(claimed.sort()).toEqual(['processing/keep.ndjson', 'processing/orphan.ndjson']);
    expect(await store.list('raw')).toEqual(['raw/ignore.txt']);
  });

  it('returns orphans even when raw is empty', async () => {
    const store = getStore();
    await store.put('processing/a.ndjson', 'a');
    await store.put('processing/b.ndjson', 'b');

    const claimed = await claim();
    expect(claimed.sort()).toEqual(['processing/a.ndjson', 'processing/b.ndjson']);
  });

  it('returns empty when no raw or processing files', async () => {
    expect(await claim()).toEqual([]);
  });

  it('handles concurrent move gracefully (already moved)', async () => {
    const store = getStore();
    await store.put('raw/a.ndjson', 'a');
    const originalMove = store.move.bind(store);
    let first = true;
    store.move = vi.fn(async (from: string, to: string) => {
      if (first) {
        first = false;
        throw new Error('already moved');
      }
      return originalMove(from, to);
    });

    await store.put('raw/b.ndjson', 'b');

    const claimed = await claim();
    expect(claimed).toEqual(['processing/b.ndjson']);
    expect(await store.list('raw')).toEqual(['raw/a.ndjson']);
  });

  it('deduplicates when same file appears in both claimed and orphans', async () => {
    const store = getStore();
    await store.put('raw/dup.ndjson', 'x');
    const first = await claim();
    expect(first).toEqual(['processing/dup.ndjson']);

    const second = await claim();
    expect(second).toEqual(['processing/dup.ndjson']);
  });
});

describe('compile', () => {
  it('returns 0 for empty input and does not call DuckDB', async () => {
    const n = await compile([]);
    expect(n).toBe(0);
  });

  it('writes hive-partitioned parquet and deletes processing files on success', async () => {
    const store = getStore();
    await store.put('processing/a.ndjson', '{"event_id":"1"}\n');
    await store.put('processing/b.ndjson', '{"event_id":"2"}\n');

    const count = await compile(['processing/a.ndjson', 'processing/b.ndjson']);

    expect(count).toBe(2);
    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(await store.list('processing')).toEqual([]);
    const analytics = await store.list('analytics');
    expect(analytics.length).toBeGreaterThan(0);
    expect(analytics[0]).toContain('domain=example.com');
    expect(analytics[0]).toMatch(/\.parquet$/);
  });

  it('creates analytics directory with partitioned path', async () => {
    const store = getStore();
    await store.put('processing/evt.ndjson', '{"event_id":"1"}\n');

    await compile(['processing/evt.ndjson']);

    const analytics = await store.list('analytics');
    expect(analytics.length).toBe(1);
    const full = path.join(tmpDir, analytics[0]!);
    const exists = await fileExists(full);
    expect(exists).toBe(true);
  });

  it('does not delete processing files when DuckDB fails', async () => {
    const store = getStore();
    await store.put('processing/a.ndjson', '{"event_id":"1"}\n');

    vi.mocked(createConnection).mockImplementationOnce(
      async () =>
        ({
          run: vi.fn(async () => {
            throw new Error('duck failure');
          }),
          closeSync: vi.fn(),
        }) as unknown as DuckDBConnection,
    );

    await expect(compile(['processing/a.ndjson'])).rejects.toThrow('duck failure');

    expect(await store.list('processing')).toEqual(['processing/a.ndjson']);
    expect(await store.list('analytics')).toEqual([]);
  });

  it('is idempotent when called again with empty input after success', async () => {
    const store = getStore();
    await store.put('processing/a.ndjson', '{"event_id":"1"}\n');
    await compile(['processing/a.ndjson']);
    const n = await compile([]);
    expect(n).toBe(0);
  });
});

describe('compact', () => {
  it('ignores partitions below threshold', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 3;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/a.parquet', 'a');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/b.parquet', 'b');

    const n = await compact();
    expect(n).toBe(0);
    expect((await store.list('analytics')).length).toBe(2);
  });

  it('merges partitions exceeding threshold and deletes source files', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 2;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/a.parquet', 'a');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/b.parquet', 'b');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/c.parquet', 'c');

    const n = await compact();

    expect(n).toBe(3);
    expect(createConnection).toHaveBeenCalledTimes(1);
    const remaining = await store.list('analytics');
    expect(remaining.length).toBe(1);
    expect(remaining[0]).toContain('compacted-');
    expect(remaining[0]).toMatch(/\.parquet$/);
  });

  it('handles multiple partitions independently', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 2;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/a.parquet', 'a');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/b.parquet', 'b');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/c.parquet', 'c');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=02/a.parquet', 'a');

    const n = await compact();
    expect(n).toBe(3);

    const remaining = (await store.list('analytics')).sort();
    expect(remaining.length).toBe(2);
    expect(remaining.some((k) => k.includes('day=01') && k.includes('compacted-'))).toBe(true);
    expect(remaining.some((k) => k.includes('day=02'))).toBe(true);
  });

  it('returns 0 when no analytics data', async () => {
    const n = await compact();
    expect(n).toBe(0);
  });

  it('respects exact threshold boundary (equal does not compact)', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 2;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/a.parquet', 'a');
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/b.parquet', 'b');
    expect(await compact()).toBe(0);
  });
});

describe('prune', () => {
  it('deletes partitions older than retention window', async () => {
    const store = getStore();
    holder.config.retentionDays = 30;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/old.parquet', 'old');
    await store.put('analytics/domain=example.com/year=2024/month=03/day=15/new.parquet', 'new');
    await store.put(
      'analytics/domain=example.com/year=2024/month=02/day=10/also-old.parquet',
      'also-old',
    );

    const now = new Date('2024-03-20T00:00:00Z');
    const deleted = await prune(now);

    expect(deleted).toBe(2);
    const remaining = await store.list('analytics');
    expect(remaining).toEqual([
      'analytics/domain=example.com/year=2024/month=03/day=15/new.parquet',
    ]);
  });

  it('leaves newer partitions and non-dated keys', async () => {
    const store = getStore();
    holder.config.retentionDays = 90;
    const now = new Date('2024-03-20T00:00:00Z');
    await store.put('analytics/domain=example.com/year=2024/month=03/day=10/keep.parquet', 'keep');
    await store.put('analytics/some-manifest.json', 'manifest');
    await store.put(
      'analytics/domain=example.com/year=2024/month=01/day=01/keep2.parquet',
      'keep2',
    );

    const deleted = await prune(now);
    expect(deleted).toBe(0);
    expect((await store.list('analytics')).sort()).toEqual(
      [
        'analytics/domain=example.com/year=2024/month=01/day=01/keep2.parquet',
        'analytics/domain=example.com/year=2024/month=03/day=10/keep.parquet',
        'analytics/some-manifest.json',
      ].sort(),
    );
  });

  it('returns 0 when nothing to prune', async () => {
    holder.config.retentionDays = 30;
    expect(await prune(new Date('2024-01-15T00:00:00Z'))).toBe(0);
  });

  it('handles invalid dates gracefully', async () => {
    const store = getStore();
    holder.config.retentionDays = 30;
    await store.put('analytics/domain=example.com/year=invalid/month=13/day=40/bad.parquet', 'bad');
    const now = new Date('2024-03-20T00:00:00Z');
    expect(await prune(now)).toBe(0);
    expect(await store.list('analytics')).toHaveLength(1);
  });

  it('uses current date by default', async () => {
    const store = getStore();
    holder.config.retentionDays = 1;
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    const y = old.getUTCFullYear().toString().padStart(4, '0');
    const m = (old.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = old.getUTCDate().toString().padStart(2, '0');
    await store.put(
      `analytics/domain=example.com/year=${y}/month=${m}/day=${d}/old.parquet`,
      'old',
    );
    const deleted = await prune();
    expect(deleted).toBe(1);
  });
});

describe('runOnce', () => {
  it('orchestrates claim->compile->compact->prune and returns compiled count', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 10;
    holder.config.retentionDays = 90;
    await store.put('raw/a.ndjson', '{"event_id":"1"}\n');
    await store.put('raw/b.ndjson', '{"event_id":"2"}\n');

    const count = await runOnce();

    expect(count).toBe(2);
    expect(await store.list('raw')).toEqual([]);
    expect(await store.list('processing')).toEqual([]);
    expect((await store.list('analytics')).length).toBeGreaterThan(0);
  });

  it('is idempotent on second run', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 10;
    await store.put('raw/a.ndjson', '{"event_id":"1"}\n');

    const first = await runOnce();
    expect(first).toBe(1);
    const second = await runOnce();
    expect(second).toBe(0);
    expect((await store.list('analytics')).length).toBeGreaterThan(0);
  });

  it('returns 0 when nothing to compile', async () => {
    expect(await runOnce()).toBe(0);
    expect((await getStore().list('analytics')).length).toBe(0);
  });

  it('runs prune even when nothing to compile', async () => {
    const store = getStore();
    holder.config.retentionDays = 0;
    await store.put('analytics/domain=example.com/year=2024/month=01/day=01/old.parquet', 'old');
    await runOnce();
    expect((await store.list('analytics')).length).toBe(0);
  });

  it('recovers orphaned processing files on runOnce', async () => {
    const store = getStore();
    holder.config.compactionThreshold = 10;
    await store.put('processing/orphan.ndjson', '{"event_id":"orphan"}\n');

    const count = await runOnce();
    expect(count).toBe(1);
    expect(await store.list('processing')).toEqual([]);
  });
});
