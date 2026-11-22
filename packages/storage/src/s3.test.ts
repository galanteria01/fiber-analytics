import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as S3Types from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-s3 — must run before the module under test is imported.
// ---------------------------------------------------------------------------
const mockSend = vi.fn();

// Capture constructor calls so duckdbSetup / S3Client options can be asserted.
let s3CtorArgs: unknown[][] = [];

vi.mock('@aws-sdk/client-s3', async () => {
  const actual = await vi.importActual<typeof S3Types>('@aws-sdk/client-s3');
  return {
    ...actual,
    S3Client: class MockS3Client {
      constructor(...args: unknown[]) {
        s3CtorArgs.push(args);
      }
      send = mockSend;
    },
  };
});

// Import after the mock is hoisted.
import type { S3Options } from './types.js';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { S3ObjectStore } from './s3.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStore(overrides: Partial<S3Options> = {}) {
  return new S3ObjectStore({
    bucket: 'my-bucket',
    region: 'us-east-1',
    ...overrides,
  });
}

beforeEach(() => {
  mockSend.mockReset();
  s3CtorArgs = [];
});

// ===========================================================================
// Tests
// ===========================================================================

describe('S3ObjectStore – constructor', () => {
  it('passes region, bucket and path-style defaults to S3Client', () => {
    makeStore({ bucket: 'b', endpoint: 'http://localhost:9000' });
    expect(s3CtorArgs).toHaveLength(1);
    const opts = s3CtorArgs[0]![0] as Record<string, unknown>;
    expect(opts.region).toBe('us-east-1');
    expect(opts.endpoint).toBe('http://localhost:9000');
    expect(opts.forcePathStyle).toBe(true);
  });

  it('uses provided forcePathStyle override', () => {
    makeStore({ bucket: 'b', endpoint: 'http://localhost:9000', forcePathStyle: false });
    const opts = s3CtorArgs[0]![0] as Record<string, unknown>;
    expect(opts.forcePathStyle).toBe(false);
  });

  it('defaults forcePathStyle to false without endpoint', () => {
    makeStore({ bucket: 'b' });
    const opts = s3CtorArgs[0]![0] as Record<string, unknown>;
    expect(opts.forcePathStyle).toBe(false);
  });

  it('passes credentials when both key id and secret are provided', () => {
    makeStore({
      bucket: 'b',
      accessKeyId: 'AKID',
      secretAccessKey: 'SECRET',
    });
    const opts = s3CtorArgs[0]![0] as Record<string, unknown>;
    expect(opts.credentials).toEqual({ accessKeyId: 'AKID', secretAccessKey: 'SECRET' });
  });

  it('omits credentials when only one half is provided', () => {
    makeStore({ bucket: 'b', accessKeyId: 'AKID' });
    const opts = s3CtorArgs[0]![0] as Record<string, unknown>;
    expect(opts.credentials).toBeUndefined();
  });
});

describe('S3ObjectStore – put', () => {
  it('sends a PutObjectCommand with the correct bucket, key and body', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore({ bucket: 'my-bucket' });
    await store.put('raw/file.ndjson', 'hello world');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd).toBeInstanceOf(PutObjectCommand);
    expect(cmd.input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'raw/file.ndjson',
      Body: 'hello world',
    });
  });

  it('applies base prefix to the key', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore({ bucket: 'my-bucket', prefix: 'ns' });
    await store.put('raw/file.ndjson', 'body');

    const cmd = mockSend.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd.input.Key).toBe('ns/raw/file.ndjson');
  });

  it('accepts Uint8Array body', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore();
    const body = new Uint8Array([1, 2, 3]);
    await store.put('raw/bin.ndjson', body);

    const cmd = mockSend.mock.calls[0]![0] as PutObjectCommand;
    expect(cmd.input.Body).toBe(body);
  });
});

describe('S3ObjectStore – get', () => {
  it('sends a GetObjectCommand and returns the body string', async () => {
    mockSend.mockResolvedValueOnce({
      Body: { transformToString: () => Promise.resolve('file contents') },
    });
    const store = makeStore();
    const result = await store.get('raw/file.ndjson');

    expect(result).toBe('file contents');
    const cmd = mockSend.mock.calls[0]![0] as GetObjectCommand;
    expect(cmd).toBeInstanceOf(GetObjectCommand);
    expect(cmd.input).toMatchObject({ Bucket: 'my-bucket', Key: 'raw/file.ndjson' });
  });

  it('returns empty string when Body is undefined', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore();
    expect(await store.get('raw/missing.ndjson')).toBe('');
  });

  it('returns empty string when Body.transformToString returns empty', async () => {
    mockSend.mockResolvedValueOnce({ Body: { transformToString: () => Promise.resolve('') } });
    const store = makeStore();
    expect(await store.get('raw/empty.ndjson')).toBe('');
  });

  it('applies base prefix to the key', async () => {
    mockSend.mockResolvedValueOnce({ Body: { transformToString: () => Promise.resolve('x') } });
    const store = makeStore({ prefix: 'ns' });
    await store.get('raw/file.ndjson');

    const cmd = mockSend.mock.calls[0]![0] as GetObjectCommand;
    expect(cmd.input.Key).toBe('ns/raw/file.ndjson');
  });
});

describe('S3ObjectStore – list', () => {
  it('returns keys relative to the store root (no prefix)', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [{ Key: 'raw/a.ndjson' }, { Key: 'raw/b.ndjson' }],
      IsTruncated: false,
    });
    const store = makeStore();
    const keys = await store.list('raw');

    expect(keys).toEqual(['raw/a.ndjson', 'raw/b.ndjson']);
    const cmd = mockSend.mock.calls[0]![0] as ListObjectsV2Command;
    expect(cmd).toBeInstanceOf(ListObjectsV2Command);
    expect(cmd.input).toMatchObject({ Bucket: 'my-bucket', Prefix: 'raw' });
  });

  it('strips base prefix from returned keys', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [{ Key: 'ns/raw/a.ndjson' }, { Key: 'ns/raw/b.ndjson' }],
      IsTruncated: false,
    });
    const store = makeStore({ prefix: 'ns' });
    const keys = await store.list('raw');

    expect(keys).toEqual(['raw/a.ndjson', 'raw/b.ndjson']);
  });

  it('skips objects without a Key', async () => {
    mockSend.mockResolvedValueOnce({
      Contents: [
        { Key: 'raw/a.ndjson' },
        {} as unknown as { Key: string },
        { Key: 'raw/c.ndjson' },
      ],
      IsTruncated: false,
    });
    const store = makeStore();
    expect(await store.list('raw')).toEqual(['raw/a.ndjson', 'raw/c.ndjson']);
  });

  it('returns empty array when Contents is undefined', async () => {
    mockSend.mockResolvedValueOnce({ IsTruncated: false });
    const store = makeStore();
    expect(await store.list('raw')).toEqual([]);
  });

  it('paginates via ContinuationToken', async () => {
    mockSend
      .mockResolvedValueOnce({
        Contents: [{ Key: 'raw/a.ndjson' }],
        IsTruncated: true,
        NextContinuationToken: 'tok-1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'raw/b.ndjson' }],
        IsTruncated: false,
      });

    const store = makeStore();
    const keys = await store.list('raw');

    expect(keys).toEqual(['raw/a.ndjson', 'raw/b.ndjson']);
    expect(mockSend).toHaveBeenCalledTimes(2);

    const firstCmd = mockSend.mock.calls[0]![0] as ListObjectsV2Command;
    expect(firstCmd.input.ContinuationToken).toBeUndefined();

    const secondCmd = mockSend.mock.calls[1]![0] as ListObjectsV2Command;
    expect(secondCmd.input.ContinuationToken).toBe('tok-1');
  });

  it('paginates across three pages', async () => {
    mockSend
      .mockResolvedValueOnce({
        Contents: [{ Key: 'raw/1.ndjson' }],
        IsTruncated: true,
        NextContinuationToken: 't1',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'raw/2.ndjson' }],
        IsTruncated: true,
        NextContinuationToken: 't2',
      })
      .mockResolvedValueOnce({
        Contents: [{ Key: 'raw/3.ndjson' }],
        IsTruncated: false,
      });

    const store = makeStore();
    expect(await store.list('raw')).toEqual(['raw/1.ndjson', 'raw/2.ndjson', 'raw/3.ndjson']);
    expect(mockSend).toHaveBeenCalledTimes(3);
  });
});

describe('S3ObjectStore – delete', () => {
  it('sends a DeleteObjectsCommand with full keys', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore();
    await store.delete(['raw/a.ndjson', 'raw/b.ndjson']);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const cmd = mockSend.mock.calls[0]![0] as DeleteObjectsCommand;
    expect(cmd).toBeInstanceOf(DeleteObjectsCommand);
    expect(cmd.input).toMatchObject({
      Bucket: 'my-bucket',
      Delete: {
        Objects: [{ Key: 'raw/a.ndjson' }, { Key: 'raw/b.ndjson' }],
      },
    });
  });

  it('applies base prefix to delete keys', async () => {
    mockSend.mockResolvedValueOnce({});
    const store = makeStore({ prefix: 'ns' });
    await store.delete(['raw/a.ndjson']);

    const cmd = mockSend.mock.calls[0]![0] as DeleteObjectsCommand;
    expect(cmd.input.Delete?.Objects).toEqual([{ Key: 'ns/raw/a.ndjson' }]);
  });

  it('does not send a command for an empty key list', async () => {
    const store = makeStore();
    await store.delete([]);

    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('S3ObjectStore – move', () => {
  it('issues CopyObject then DeleteObject', async () => {
    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const store = makeStore();
    await store.move('raw/a.ndjson', 'processing/a.ndjson');

    expect(mockSend).toHaveBeenCalledTimes(2);

    const copyCmd = mockSend.mock.calls[0]![0] as CopyObjectCommand;
    expect(copyCmd).toBeInstanceOf(CopyObjectCommand);
    expect(copyCmd.input).toMatchObject({
      Bucket: 'my-bucket',
      CopySource: 'my-bucket/raw/a.ndjson',
      Key: 'processing/a.ndjson',
    });

    const delCmd = mockSend.mock.calls[1]![0] as DeleteObjectCommand;
    expect(delCmd).toBeInstanceOf(DeleteObjectCommand);
    expect(delCmd.input).toMatchObject({
      Bucket: 'my-bucket',
      Key: 'raw/a.ndjson',
    });
  });

  it('applies base prefix to both source and destination in move', async () => {
    mockSend.mockResolvedValueOnce({}).mockResolvedValueOnce({});
    const store = makeStore({ bucket: 'b', prefix: 'ns' });
    await store.move('raw/a.ndjson', 'processing/a.ndjson');

    const copyCmd = mockSend.mock.calls[0]![0] as CopyObjectCommand;
    expect(copyCmd.input.CopySource).toBe('b/ns/raw/a.ndjson');
    expect(copyCmd.input.Key).toBe('ns/processing/a.ndjson');

    const delCmd = mockSend.mock.calls[1]![0] as DeleteObjectCommand;
    expect(delCmd.input.Key).toBe('ns/raw/a.ndjson');
  });
});

describe('S3ObjectStore – uri / glob / writeTarget', () => {
  it('uri produces s3:// URI with base prefix', () => {
    const plain = makeStore({ bucket: 'my-bucket' });
    expect(plain.uri('analytics/x.parquet')).toBe('s3://my-bucket/analytics/x.parquet');

    const prefixed = makeStore({ bucket: 'my-bucket', prefix: 'ns' });
    expect(prefixed.uri('analytics/x.parquet')).toBe('s3://my-bucket/ns/analytics/x.parquet');
  });

  it('glob produces s3:// URI with pattern', () => {
    const plain = makeStore({ bucket: 'my-bucket' });
    expect(plain.glob('analytics', '*.parquet')).toBe('s3://my-bucket/analytics/**/*.parquet');

    const prefixed = makeStore({ bucket: 'my-bucket', prefix: 'ns' });
    expect(prefixed.glob('analytics', '*.parquet')).toBe(
      's3://my-bucket/ns/analytics/**/*.parquet',
    );
  });

  it('writeTarget produces s3:// URI for prefix', () => {
    const plain = makeStore({ bucket: 'my-bucket' });
    expect(plain.writeTarget('analytics')).toBe('s3://my-bucket/analytics');

    const prefixed = makeStore({ bucket: 'my-bucket', prefix: 'ns' });
    expect(prefixed.writeTarget('analytics')).toBe('s3://my-bucket/ns/analytics');
  });

  it('handles prefix with trailing slash', () => {
    const store = makeStore({ bucket: 'my-bucket', prefix: 'ns/' });
    expect(store.uri('raw/a.ndjson')).toBe('s3://my-bucket/ns/raw/a.ndjson');
  });

  it('kind is s3', () => {
    expect(makeStore().kind).toBe('s3');
  });
});

describe('S3ObjectStore – duckdbSetup', () => {
  it('includes httpfs install/load and S3 secret SQL', () => {
    const store = makeStore({
      bucket: 'my-bucket',
      region: 'eu-west-1',
      accessKeyId: 'AKID',
      secretAccessKey: 'SECRET',
    });
    const stmts = store.duckdbSetup();

    expect(stmts).toHaveLength(3);
    expect(stmts[0]).toBe('INSTALL httpfs;');
    expect(stmts[1]).toBe('LOAD httpfs;');
    expect(stmts[2]).toContain('TYPE S3');
    expect(stmts[2]).toContain("KEY_ID 'AKID'");
    expect(stmts[2]).toContain("SECRET 'SECRET'");
    expect(stmts[2]).toContain("REGION 'eu-west-1'");
    expect(stmts[2]).toMatch(/^CREATE OR REPLACE SECRET fiber_s3 \(.*\);$/);
  });

  it('defaults region to us-east-1 when not provided', () => {
    const store = makeStore({ bucket: 'b' });
    expect(store.duckdbSetup()[2]).toContain("REGION 'us-east-1'");
  });

  it('omits KEY_ID and SECRET when credentials are absent', () => {
    const store = makeStore({ bucket: 'b' });
    const secret = store.duckdbSetup()[2]!;
    expect(secret).not.toContain('KEY_ID');
    expect(secret).not.toContain("SECRET '");
  });

  it('includes endpoint, URL_STYLE and USE_SSL for MinIO-style http endpoint', () => {
    const store = makeStore({
      bucket: 'b',
      endpoint: 'http://localhost:9000',
      region: 'us-east-1',
    });
    const secret = store.duckdbSetup()[2]!;
    expect(secret).toContain("ENDPOINT 'localhost:9000'");
    expect(secret).toContain("URL_STYLE 'path'");
    expect(secret).toContain('USE_SSL false');
  });

  it('includes endpoint and URL_STYLE but not USE_SSL for https endpoint', () => {
    const store = makeStore({
      bucket: 'b',
      endpoint: 'https://s3.example.com',
      region: 'us-east-1',
    });
    const secret = store.duckdbSetup()[2]!;
    expect(secret).toContain("ENDPOINT 's3.example.com'");
    expect(secret).toContain("URL_STYLE 'path'");
    expect(secret).not.toContain('USE_SSL');
  });

  it('escapes single quotes in credentials and endpoint', () => {
    const store = makeStore({
      bucket: 'b',
      accessKeyId: "it's",
      secretAccessKey: "sec'ret",
      endpoint: "http://host/o'brien",
    });
    const secret = store.duckdbSetup()[2]!;
    expect(secret).toContain("KEY_ID 'it''s'");
    expect(secret).toContain("SECRET 'sec''ret'");
    expect(secret).toContain("ENDPOINT 'host/o''brien'");
  });

  it('strips http:// and https:// from endpoint in secret', () => {
    const http = makeStore({ bucket: 'b', endpoint: 'http://minio:9000' });
    expect(http.duckdbSetup()[2]).toContain("ENDPOINT 'minio:9000'");

    const https = makeStore({ bucket: 'b', endpoint: 'https://s3.amazonaws.com' });
    expect(https.duckdbSetup()[2]).toContain("ENDPOINT 's3.amazonaws.com'");
  });

  it('escapes single quotes in region', () => {
    const store = makeStore({ bucket: 'b', region: "us-east-1'" });
    expect(store.duckdbSetup()[2]).toContain("REGION 'us-east-1'''");
  });
});
