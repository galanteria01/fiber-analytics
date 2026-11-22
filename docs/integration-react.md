# Browser SDK

> Cookieless, non-blocking event capture for React apps — delegated listeners, session ordering, consent gating, and an idle-time transport.

Package: `@fiber-analytics/browser`.

## Setup

```bash
pnpm add @fiber-analytics/browser
```

Call `init()` once near the top of your app (e.g. `apps/demo/src/main.tsx`). A second call on the same page is a no-op.

```tsx
import { init } from '@fiber-analytics/browser';

init({
  endpoint: 'https://analytics.example.com/api/ingest',
  domain: 'app.example.com',
});
```

### Minimal JSX example

Any interactive element tagged by the compiler is captured automatically — no extra code per component:

```tsx
// src/main.tsx — one-time setup
import { init } from '@fiber-analytics/browser';

init({
  endpoint: import.meta.env.VITE_FA_ENDPOINT ?? 'http://localhost:3000/api/ingest',
  domain: 'app.example.com',
  debug: true, // localhost overlay
});

// src/components/Checkout.tsx — zero instrumentation needed
export function Checkout({ price, tier }: { price: number; tier: string }) {
  return (
    <button onClick={handleBuy}>
      Buy {tier} — ${price}
    </button>
  );
  // At build time this becomes:
  // <button data-fa-comp="Checkout" data-fa-props='{"tier":"pro","price":29}' onClick={...}>
}

// src/components/LoginForm.tsx — opt-out
export function LoginForm() {
  return (
    <button data-fa-ignore onClick={handleLogin}>
      Sign in
    </button>
  );
}
```

At runtime the SDK finds the tagged ancestor via `element.closest('[data-fa-comp]')`, reads `data-fa-comp` / `data-fa-props` / `data-fa-loc`, and emits a `ClientEvent` enriched with session, pageview, sequencing, and page context.

## `init(config)` signature

Defined in `packages/core/src/types.ts:FiberAnalyticsConfig` and implemented in `packages/browser/src/index.ts:init`.

| Field              | Type      | Default          | Description                                                                                                                                             |
| ------------------ | --------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `endpoint`         | `string`  | _(required)_     | Absolute URL of the ingestion endpoint (`POST` target).                                                                                                 |
| `domain`           | `string`  | _(required)_     | Logical application domain, used for hive partitioning (`analytics/domain=<domain>/…`).                                                                 |
| `debug`            | `boolean` | `false`          | When `true` **and** on `localhost`/`127.0.0.1`/`[::1]`, renders a live overlay panel listing captured events.                                           |
| `maxBatchSize`     | `number`  | `25`             | Max events buffered before an eager flush is scheduled.                                                                                                 |
| `flushTimeout`     | `number`  | `2000`           | Idle-callback timeout (ms) before forcing a flush.                                                                                                      |
| `consent`          | `boolean` | `true`           | Initial consent state. When `false`, events are dropped until `setConsent(true)` is called.                                                             |
| `respectDnt`       | `boolean` | `true`           | When `true`, a browser DNT (`doNotTrack === "1"` / `"yes"`) or GPC (`globalPrivacyControl === true`) signal forces consent off regardless of `consent`. |
| `sessionTimeoutMs` | `number`  | `30 * 60 * 1000` | Sliding inactivity window (ms) before a new `session_id` is minted.                                                                                     |
| `trackPageViews`   | `boolean` | `true`           | Automatically emit `page_view` events on SPA navigations (History API).                                                                                 |
| `maxRetries`       | `number`  | `3`              | Max delivery retry attempts for a failed batch (exponential backoff).                                                                                   |

### Example with consent + page-view control

```ts
init({
  endpoint: 'https://analytics.example.com/api/ingest',
  domain: 'app.example.com',
  consent: false, // start blocked; gate behind a banner
  respectDnt: true,
  trackPageViews: false, // emit page_view manually instead
});
```

## Consent gate

The SDK respects two signals:

1. **Browser opt-out** — when `respectDnt` is enabled, `ConsentManager` checks `navigator.globalPrivacyControl` and `navigator.doNotTrack` / `window.doNotTrack` / `navigator.msDoNotTrack` at init time. If either signals opt-out, consent is forced off.
2. **Explicit consent** — `init({ consent: false })` starts with consent denied.

Update consent at runtime:

```ts
import { setConsent } from '@fiber-analytics/browser';

// User accepted the banner / toggled a preference
setConsent(true);

// User revoked
setConsent(false);
```

While consent is denied the SDK's `emit` path drops events entirely — nothing is buffered or sent.

## Manual `track` / `page`

For events that are not tied to a DOM interaction (e.g. a successful mutation, a feature-flag exposure), use the manual API from `packages/browser/src/track.ts`:

```ts
import { track, page } from '@fiber-analytics/browser';

// Custom event with safelisted props
track('checkout_completed', { value: 29, currency: 'usd' });

// Manually emit a page_view (useful when trackPageViews is false)
page();
```

- `track(name, props?)` — emits `event_type: 'custom'` with `event_name` and `component_name` set to `name`. `props` are run through `safelistProps` (only primitives; sensitive keys dropped).
- `page()` — emits `event_type: 'page_view'` with the current navigation's `PageView` context.

Both are no-ops when the SDK is not initialized or consent is denied.

### `data-fa-comp` propagation

Manual events have `component_name` set to the passed `name` argument, not to a DOM `data-fa-comp`. Auto-captured DOM events read `data-fa-comp` from the tagged ancestor. Both shapes produce the same `AnalyticsEvent.component_name` column in storage — filters and the dashboard treat them uniformly.

## SPA pageviews and session ordering

- `PageContext` captures `url_path`, `referrer`, `page_title`, `viewport_w/h`, `locale`, `device`, and any `utm_*` query params once per navigation. Every event on that page carries this context.
- `NavigationTracker` listens to `pushState`/`replaceState`/`popstate` and mints a fresh `PageView` (new `pageview_id`) on each navigation, emitting a `page_view` event when `trackPageViews` is true.
- `SessionManager` holds a cookieless `session_id` in `sessionStorage` with a sliding inactivity window (`sessionTimeoutMs`, default 30 min). A monotonic `seq` per session provides deterministic ordering even when network delivery is out of order.

## Delivery and retry

- `BatchQueue` buffers events and flushes on an idle callback (`requestIdleCallback` with `flushTimeout` fallback). When the buffer reaches `maxBatchSize` the timeout is forced to `0` for an eager flush.
- `Transport.send` delivers via `fetch` with retry + backoff (up to `maxRetries`). After exhausting retries the batch is spilled to `localStorage` (`fa_spillover`, capped at 1000 events) and retried once on next init via `flushSpillover()`.
- On page hide (`visibilitychange` -> `hidden`) the queue flushes synchronously via chunked `navigator.sendBeacon` (payloads chunked to ~60 KB per chunk to stay under the beacon ceiling).

## Teardown

```ts
import { shutdown } from '@fiber-analytics/browser';

shutdown();
```

Removes all delegated listeners, clears the overlay if any, disconnects the navigation tracker, and tears down the queue/transport — useful in tests and during HMR. A subsequent `init()` starts fresh.

## Related docs

- [Architecture](architecture.md) — where the SDK sits in the data flow.
- [Compiler — Vite](integration-vite.md) — how `data-fa-*` attributes are injected at build.
- [Compiler — Next.js](integration-nextjs.md) — Next.js variant.
- [Privacy](privacy.md) — session model, IP truncation, DNT/GPC, redaction, retention.
- [Deployment](deployment.md) — configuring `endpoint` per environment.
