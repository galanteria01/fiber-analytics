import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { AnalyticsEvent } from '@fiber-analytics/core';
import { BUFFER_DIR } from './paths';

/**
 * A buffered row: the immutable event plus the partitioning domain. Properties
 * are stored as a JSON string so the Parquet column type stays a stable VARCHAR
 * across partitions (avoids struct-schema drift when globbing).
 */
interface BufferRow extends Omit<AnalyticsEvent, 'properties'> {
  properties: string;
  domain: string;
}

/**
 * Appends a batch of enriched events to the buffer as a single newline-
 * delimited JSON file. Each request writes its own uniquely named file so
 * concurrent ingestion never races on a shared handle, and the sync worker can
 * safely claim whole files.
 */
export async function bufferEvents(domain: string, events: AnalyticsEvent[]): Promise<void> {
  if (events.length === 0) return;
  await mkdir(BUFFER_DIR, { recursive: true });

  const lines = events
    .map((event) => {
      const row: BufferRow = {
        event_id: event.event_id,
        session_hash: event.session_hash,
        timestamp: event.timestamp,
        event_type: event.event_type,
        component_name: event.component_name,
        properties: JSON.stringify(event.properties),
        url_path: event.url_path,
        domain,
      };
      return JSON.stringify(row);
    })
    .join('\n');

  const filename = `${Date.now()}-${randomUUID()}.jsonl`;
  await writeFile(path.join(BUFFER_DIR, filename), `${lines}\n`, 'utf8');
}
