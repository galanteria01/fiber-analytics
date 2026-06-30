import path from 'node:path';
import {
  createObjectStoreFromEnv,
  ANALYTICS_PREFIX,
  RAW_PREFIX,
  PROCESSING_PREFIX,
  type ObjectStore,
} from '@fiber-analytics/storage';

/**
 * Default local object-store root: the repository `data/` directory (two levels
 * up from `apps/dashboard`). Overridden by `FA_DATA_DIR`, or replaced entirely
 * by the S3 adapter when `FA_STORAGE=s3`.
 */
const DEFAULT_LOCAL_ROOT = path.resolve(process.cwd(), '../../data');

let cached: ObjectStore | null = null;

export function getStore(): ObjectStore {
  if (!cached) cached = createObjectStoreFromEnv(process.env, DEFAULT_LOCAL_ROOT);
  return cached;
}

export { ANALYTICS_PREFIX, RAW_PREFIX, PROCESSING_PREFIX };
