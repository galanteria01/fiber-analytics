import path from 'node:path';
import { LocalObjectStore } from './local.js';
import { S3ObjectStore } from './s3.js';
import type { ObjectStore } from './types.js';

type Env = Record<string, string | undefined>;

/**
 * Builds an {@link ObjectStore} from environment variables.
 *
 * - `FA_STORAGE=local` (default): filesystem store rooted at `FA_DATA_DIR`
 *   (or `defaultLocalRoot`).
 * - `FA_STORAGE=s3`: S3-compatible store configured via `FA_S3_*`.
 */
export function createObjectStoreFromEnv(
  env: Env = process.env,
  defaultLocalRoot: string = path.resolve(process.cwd(), 'data'),
): ObjectStore {
  const kind = (env.FA_STORAGE ?? 'local').toLowerCase();

  if (kind === 's3') {
    const bucket = env.FA_S3_BUCKET;
    if (!bucket) {
      throw new Error('FA_STORAGE=s3 requires FA_S3_BUCKET to be set');
    }
    return new S3ObjectStore({
      bucket,
      region: env.FA_S3_REGION,
      endpoint: env.FA_S3_ENDPOINT,
      accessKeyId: env.FA_S3_ACCESS_KEY_ID,
      secretAccessKey: env.FA_S3_SECRET_ACCESS_KEY,
      prefix: env.FA_S3_PREFIX,
      forcePathStyle: env.FA_S3_FORCE_PATH_STYLE
        ? env.FA_S3_FORCE_PATH_STYLE === 'true'
        : undefined,
    });
  }

  const root = env.FA_DATA_DIR ? path.resolve(env.FA_DATA_DIR) : defaultLocalRoot;
  return new LocalObjectStore(root);
}

/** Conventional prefixes within the store. */
export const RAW_PREFIX = 'raw';
export const PROCESSING_PREFIX = 'processing';
export const ANALYTICS_PREFIX = 'analytics';
