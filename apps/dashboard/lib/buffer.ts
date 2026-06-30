import { randomUUID } from 'node:crypto';
import type { AnalyticsEvent } from '@fiber-analytics/core';
import { getStore, RAW_PREFIX } from './store';

/**
 * A persisted row: the immutable event flattened for columnar storage. The
 * `properties` map is serialized to a JSON string so the Parquet column type
 * stays a stable VARCHAR across partitions (avoids struct-schema drift).
 */
interface RawRow extends Omit<AnalyticsEvent, 'properties'> {
  properties: string;
  domain: string;
}

function toRow(event: AnalyticsEvent, domain: string): RawRow {
  return { ...event, properties: JSON.stringify(event.properties), domain };
}

/**
 * Writes a batch of enriched events as a single newline-delimited JSON object
 * under the store's `raw/` prefix. Each request writes a uniquely named object
 * so concurrent ingestion never races, and the worker can claim whole objects.
 * Writing to the object store (not local fs) keeps the edge serverless-safe.
 */
export async function bufferEvents(domain: string, events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;
  const body = events.map((event) => JSON.stringify(toRow(event, domain))).join('\n');
  const key = `${RAW_PREFIX}/${Date.now()}-${randomUUID()}.ndjson`;
  await getStore().put(key, `${body}\n`);
}
