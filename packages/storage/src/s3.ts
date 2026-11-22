import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectStore, S3Options } from './types.js';

function joinKey(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((p) => p.replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
}

function sqlEscape(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * S3-compatible {@link ObjectStore}. Works against AWS S3 or any S3 API
 * implementation (e.g. MinIO) via a custom `endpoint` + path-style addressing.
 * DuckDB reads/writes the same objects through the `httpfs` extension.
 */
export class S3ObjectStore implements ObjectStore {
  readonly kind = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly base: string;
  private readonly options: S3Options;

  constructor(options: S3Options) {
    this.options = options;
    this.bucket = options.bucket;
    this.base = options.prefix ? joinKey(options.prefix) : '';
    this.client = new S3Client({
      region: options.region ?? 'us-east-1',
      endpoint: options.endpoint,
      forcePathStyle: options.forcePathStyle ?? Boolean(options.endpoint),
      credentials:
        options.accessKeyId && options.secretAccessKey
          ? { accessKeyId: options.accessKeyId, secretAccessKey: options.secretAccessKey }
          : undefined,
    });
  }

  private fullKey(key: string): string {
    return joinKey(this.base, key);
  }

  async put(key: string, body: string | Uint8Array): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key), Body: body }),
    );
  }

  async get(key: string): Promise<string> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.fullKey(key) }),
    );
    return (await res.Body?.transformToString()) ?? '';
  }

  async list(prefix: string): Promise<string[]> {
    const fullPrefix = this.fullKey(prefix);
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const res = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: fullPrefix,
          ContinuationToken: token,
        }),
      );
      for (const obj of res.Contents ?? []) {
        if (!obj.Key) continue;
        const relative = this.base ? obj.Key.slice(this.base.length + 1) : obj.Key;
        keys.push(relative);
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return keys;
  }

  async delete(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    // DeleteObjects supports at most 1000 keys per request.
    for (let i = 0; i < keys.length; i += 1000) {
      const batch = keys.slice(i, i + 1000);
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: this.bucket,
          Delete: { Objects: batch.map((key) => ({ Key: this.fullKey(key) })) },
        }),
      );
    }
  }

  async move(fromKey: string, toKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: encodeURI(`${this.bucket}/${this.fullKey(fromKey)}`),
        Key: this.fullKey(toKey),
      }),
    );
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.fullKey(fromKey) }),
    );
  }

  uri(key: string): string {
    return `s3://${this.bucket}/${this.fullKey(key)}`;
  }

  glob(prefix: string, pattern: string): string {
    return `s3://${this.bucket}/${this.fullKey(prefix)}/**/${pattern}`;
  }

  writeTarget(prefix: string): string {
    return `s3://${this.bucket}/${this.fullKey(prefix)}`;
  }

  duckdbSetup(): string[] {
    const o = this.options;
    const parts = [
      'TYPE S3',
      o.accessKeyId ? `KEY_ID '${sqlEscape(o.accessKeyId)}'` : '',
      o.secretAccessKey ? `SECRET '${sqlEscape(o.secretAccessKey)}'` : '',
      `REGION '${sqlEscape(o.region ?? 'us-east-1')}'`,
      o.endpoint ? `ENDPOINT '${sqlEscape(o.endpoint.replace(/^https?:\/\//, ''))}'` : '',
      o.endpoint ? "URL_STYLE 'path'" : '',
      o.endpoint && o.endpoint.startsWith('http://') ? 'USE_SSL false' : '',
    ].filter(Boolean);

    return [
      'INSTALL httpfs;',
      'LOAD httpfs;',
      `CREATE OR REPLACE SECRET fiber_s3 (${parts.join(', ')});`,
    ];
  }
}
