import type { ClientEvent, IngestPayload } from '@fiber-analytics/core';

interface TransportOptions {
  endpoint: string;
  domain: string;
  maxRetries: number;
}

/** Stay comfortably under the ~64KB `sendBeacon` payload ceiling. */
const BEACON_LIMIT_BYTES = 60_000;
const SPILLOVER_KEY = 'fa_spillover';
const SPILLOVER_MAX = 1000;

function encode(payload: IngestPayload): string {
  return JSON.stringify(payload);
}

/**
 * Splits events into chunks whose serialized payload stays under the beacon
 * byte limit, so large bursts are delivered reliably on page hide.
 */
function chunk(domain: string, events: ClientEvent[]): IngestPayload[] {
  const payloads: IngestPayload[] = [];
  let current: ClientEvent[] = [];
  for (const event of events) {
    current.push(event);
    if (
      new TextEncoder().encode(encode({ domain, events: current })).length >= BEACON_LIMIT_BYTES &&
      current.length > 1
    ) {
      current.pop();
      payloads.push({ domain, events: current });
      current = [event];
    }
  }
  if (current.length > 0) payloads.push({ domain, events: current });
  return payloads;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Reliable event transport with retry+backoff, `localStorage` spillover for
 * batches that fail after exhausting retries, and beacon chunking. Telemetry
 * failures never surface to the host app.
 */
export class Transport {
  constructor(private readonly options: TransportOptions) {}

  /** Best-effort delivery with retries; spills to localStorage on hard failure. */
  async send(events: ClientEvent[]): Promise<void> {
    if (events.length === 0) return;
    const body = encode({ domain: this.options.domain, events });

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt += 1) {
      try {
        const res = await fetch(this.options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body,
          keepalive: true,
        });
        if (res.ok) return;
        // 4xx (except 429) are non-retryable: drop the batch.
        if (res.status >= 400 && res.status < 500 && res.status !== 429) return;
      } catch {
        // network error: fall through to retry/backoff
      }
      if (attempt < this.options.maxRetries) await sleep(2 ** attempt * 250);
    }

    this.spill(events);
  }

  /** Synchronous, chunked delivery for page-hide via `sendBeacon`. */
  sendBeacon(events: ClientEvent[]): void {
    if (events.length === 0) return;
    for (const payload of chunk(this.options.domain, events)) {
      const blob = new Blob([encode(payload)], { type: 'application/json' });
      const ok =
        typeof navigator.sendBeacon === 'function' &&
        navigator.sendBeacon(this.options.endpoint, blob);
      if (!ok) {
        void fetch(this.options.endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: encode(payload),
          keepalive: true,
        }).catch(() => undefined);
      }
    }
  }

  private spill(events: ClientEvent[]): void {
    try {
      const existing = this.readSpillover();
      const merged = [...existing, ...events].slice(-SPILLOVER_MAX);
      localStorage.setItem(SPILLOVER_KEY, JSON.stringify(merged));
    } catch {
      // storage unavailable; drop.
    }
  }

  private readSpillover(): ClientEvent[] {
    try {
      const raw = localStorage.getItem(SPILLOVER_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as ClientEvent[]) : [];
    } catch {
      return [];
    }
  }

  /** Re-attempts any previously spilled batches (called once on init). */
  async flushSpillover(): Promise<void> {
    const spilled = this.readSpillover();
    if (spilled.length === 0) return;
    try {
      localStorage.removeItem(SPILLOVER_KEY);
    } catch {
      // ignore
    }
    await this.send(spilled);
  }
}
