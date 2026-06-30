import type { ClientEvent, IngestPayload } from '@fiber-analytics/core';

interface QueueOptions {
  endpoint: string;
  domain: string;
  maxBatchSize: number;
  flushTimeout: number;
}

type IdleScheduler = (cb: () => void, timeout: number) => void;

const scheduleIdle: IdleScheduler =
  typeof requestIdleCallback === 'function'
    ? (cb, timeout) => {
        requestIdleCallback(cb, { timeout });
      }
    : (cb, timeout) => {
        setTimeout(cb, Math.min(timeout, 200));
      };

/**
 * In-memory batch queue. Events are buffered and dispatched during browser idle
 * time (`requestIdleCallback`) to keep the main thread free; on page-hide the
 * queue is flushed synchronously via `navigator.sendBeacon`.
 *
 * The queue is intentionally module/instance state rather than React state so
 * that high-frequency pushes never trigger re-renders.
 */
export class BatchQueue {
  private readonly events: ClientEvent[] = [];
  private flushScheduled = false;

  constructor(private readonly options: QueueOptions) {}

  push(event: ClientEvent): void {
    this.events.push(event);
    if (this.events.length >= this.options.maxBatchSize) {
      this.scheduleFlush(0);
    } else {
      this.scheduleFlush(this.options.flushTimeout);
    }
  }

  private scheduleFlush(timeout: number): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    scheduleIdle(() => {
      this.flushScheduled = false;
      this.flush();
    }, timeout);
  }

  /**
   * Sends all buffered events. When `useBeacon` is true (page is being hidden)
   * the send is fire-and-forget via `sendBeacon`; otherwise a keepalive
   * `fetch` is used.
   */
  flush(useBeacon = false): void {
    if (this.events.length === 0) return;

    const payload: IngestPayload = {
      domain: this.options.domain,
      events: this.events.splice(0, this.events.length),
    };
    const body = JSON.stringify(payload);

    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(this.options.endpoint, new Blob([body], { type: 'application/json' }));
      return;
    }

    void fetch(this.options.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Telemetry must never throw into the host app; drop on failure.
    });
  }

  get size(): number {
    return this.events.length;
  }
}
