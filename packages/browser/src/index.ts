import type { ClientEvent, FiberAnalyticsConfig } from '@fiber-analytics/core';
import { BatchQueue } from './queue.js';
import { bindInterceptors } from './interceptor.js';
import { trackState } from './state-tracker.js';
import { createOverlay, isLocalhost, type Overlay } from './overlay.js';

const DEFAULT_MAX_BATCH = 25;
const DEFAULT_FLUSH_TIMEOUT = 2000;

interface Instance {
  teardown: () => void;
}

// Module-level guard so init runs at most once per page load.
let instance: Instance | null = null;

/**
 * Initializes FiberAnalytics: wires the delegated event interceptor, the
 * visibility state tracker, the idle batch queue, and (on localhost in debug
 * mode) the live validation overlay.
 *
 * Safe to call multiple times; subsequent calls are no-ops.
 */
export function init(config: FiberAnalyticsConfig): void {
  if (instance) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const queue = new BatchQueue({
    endpoint: config.endpoint,
    domain: config.domain,
    maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH,
    flushTimeout: config.flushTimeout ?? DEFAULT_FLUSH_TIMEOUT,
  });

  const overlay: Overlay | null = config.debug && isLocalhost() ? createOverlay() : null;

  const emit = (event: ClientEvent): void => {
    queue.push(event);
    overlay?.record(event);
  };

  const start = (): void => {
    const unbindClicks = bindInterceptors(emit);
    const unbindState = trackState(emit);

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') queue.flush(true);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', () => queue.flush(true));

    instance = {
      teardown() {
        unbindClicks();
        unbindState();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        overlay?.destroy();
        instance = null;
      },
    };
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}

/**
 * Tears down all listeners and the overlay. Primarily useful for tests / HMR.
 */
export function shutdown(): void {
  instance?.teardown();
}

export type { FiberAnalyticsConfig } from '@fiber-analytics/core';
