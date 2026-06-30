import type { ClientEvent, EventContext, FiberAnalyticsConfig } from '@fiber-analytics/core';
import { BatchQueue } from './queue.js';
import { Transport } from './transport.js';
import { SessionManager } from './session.js';
import { PageContext } from './context.js';
import { ConsentManager } from './consent.js';
import { NavigationTracker } from './navigation.js';
import { bindInterceptors } from './interceptor.js';
import { trackState } from './state-tracker.js';
import { createPageViewEvent, type Enricher } from './event-factory.js';
import { registerManual, track, page } from './track.js';
import { createOverlay, isLocalhost, type Overlay } from './overlay.js';

const DEFAULT_MAX_BATCH = 25;
const DEFAULT_FLUSH_TIMEOUT = 2000;
const DEFAULT_SESSION_TIMEOUT = 30 * 60 * 1000;
const DEFAULT_MAX_RETRIES = 3;

interface Instance {
  setConsent: (granted: boolean) => void;
  teardown: () => void;
}

let instance: Instance | null = null;

/**
 * Initializes FiberAnalytics: client session + ordering, SPA page-view
 * tracking, context enrichment, consent gating, the delegated interceptor, the
 * visibility tracker, the retrying transport, and (on localhost in debug mode)
 * the live overlay. Safe to call once per page load; subsequent calls are no-ops.
 */
export function init(config: FiberAnalyticsConfig): void {
  if (instance) return;
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  const session = new SessionManager(config.sessionTimeoutMs ?? DEFAULT_SESSION_TIMEOUT);
  const pageContext = new PageContext();
  const consent = new ConsentManager(config.consent ?? true, config.respectDnt ?? true);

  const transport = new Transport({
    endpoint: config.endpoint,
    domain: config.domain,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
  });

  const queue = new BatchQueue({
    transport,
    maxBatchSize: config.maxBatchSize ?? DEFAULT_MAX_BATCH,
    flushTimeout: config.flushTimeout ?? DEFAULT_FLUSH_TIMEOUT,
  });

  const overlay: Overlay | null = config.debug && isLocalhost() ? createOverlay() : null;

  const enricher: Enricher = {
    get sessionId() {
      return session.sessionId;
    },
    get pageview() {
      return navigation.pageview;
    },
    context(): EventContext {
      return pageContext.snapshot();
    },
    nextSeq() {
      return session.nextSeq();
    },
  };

  // Consent-gated emit: events are dropped entirely until consent is granted.
  const emit = (event: ClientEvent): void => {
    if (!consent.isGranted) return;
    queue.push(event);
    overlay?.record(event);
  };

  // Each SPA navigation mints a fresh pageview and emits a page_view event.
  const navigation = new NavigationTracker(() => emit(createPageViewEvent(enricher)));

  const start = (): void => {
    void transport.flushSpillover();
    registerManual({ enricher, emit });

    const unbindClicks = bindInterceptors(enricher, emit);
    const unbindState = trackState(enricher, emit);
    if (config.trackPageViews ?? true) navigation.start();

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') queue.flush(true);
    };
    const onPageHide = (): void => queue.flush(true);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);

    instance = {
      setConsent(granted) {
        consent.set(granted);
      },
      teardown() {
        unbindClicks();
        unbindState();
        navigation.teardown();
        registerManual(null);
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pagehide', onPageHide);
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

/** Updates consent at runtime. Granting begins capture; revoking stops it. */
export function setConsent(granted: boolean): void {
  instance?.setConsent(granted);
}

/** Tears down all listeners and the overlay. Useful for tests / HMR. */
export function shutdown(): void {
  instance?.teardown();
}

export { track, page };
export type { FiberAnalyticsConfig } from '@fiber-analytics/core';
