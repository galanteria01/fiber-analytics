import type { ClientEvent } from '@fiber-analytics/core';
import type { Transport } from './transport.js';

interface QueueOptions {
  transport: Transport;
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
 * time to keep the main thread free; on page-hide the queue is flushed via
 * chunked `sendBeacon`. Delivery, retries, and spillover are owned by the
 * injected {@link Transport}.
 */
export class BatchQueue {
  private readonly events: ClientEvent[] = [];
  private flushScheduled = false;

  constructor(private readonly options: QueueOptions) {}

  push(event: ClientEvent): void {
    this.events.push(event);
    this.scheduleFlush(this.events.length >= this.options.maxBatchSize ? 0 : this.options.flushTimeout);
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
   * Sends all buffered events. When `useBeacon` is true (page being hidden) the
   * send is synchronous and chunked; otherwise it uses the retrying transport.
   */
  flush(useBeacon = false): void {
    if (this.events.length === 0) return;
    const batch = this.events.splice(0, this.events.length);
    if (useBeacon) {
      this.options.transport.sendBeacon(batch);
    } else {
      void this.options.transport.send(batch);
    }
  }

  get size(): number {
    return this.events.length;
  }
}
