# FiberAnalytics — Minimal Vite Example

A bare-bones Vite + React app that demonstrates FiberAnalytics auto-tagging end-to-end. One button, one form, and a small on-page overlay that mirrors captured events.

## What it shows

- `vite.config.ts` registers `@fiber-analytics/compiler/vite` with `includeSourceLocation: true` so the compiler injects `data-fa-comp` / `data-fa-props` / `data-fa-loc` onto interactive JSX at build time.
- `src/main.tsx` calls `init()` from `@fiber-analytics/browser` (with `debug: true` so a floating overlay appears on `localhost`).
- `src/App.tsx` renders one button and one form — no manual `track()` calls. The delegated click/submit interceptors do the rest.

## How to run

From the workspace root (recommended — uses `workspace:*` links):

```bash
pnpm install
pnpm build:packages
pnpm --filter minimal-vite dev
```

Or standalone (after building the packages once):

```bash
cd examples/minimal-vite
pnpm dev
```

Then open http://localhost:5173 and click the button / submit the form.

To point the SDK at a different ingest URL:

```bash
VITE_FA_ENDPOINT=https://your-dashboard.example.com/api/ingest pnpm --filter minimal-vite dev
```

## Expected output

### Console (DevTools → Console)

With `debug: true` the SDK logs every captured event:

```
[fiber-analytics] captured { event_type: "click", component_name: "App", session_id: "…", … }
```

The on-page panel under the button mirrors these entries (last 20).

### Network (DevTools → Network)

After the idle flush timeout (~2 s) or when the batch fills, the SDK sends:

```
POST /api/ingest  204
Content-Type: application/json

{
  "events": [
    {
      "event_id": "…",
      "event_type": "click",
      "component_name": "App",
      "session_id": "…",
      "pageview_id": "…",
      "seq": 1,
      "timestamp": "…",
      "occurred_at": "…",
      "properties": { … },
      "url_path": "/",
      "source_loc": "src/App.tsx:42:8"
      // … plus context fields (referrer, viewport_w/h, locale, device, etc.)
    }
  ],
  "domain": "app.com"
}
```

Key fields to look for: `event_type`, `component_name`, `session_id`, `pageview_id`. The server enriches additional fields (IP-derived `session_hash`, clamped `timestamp`) before buffering to the object store. Run `pnpm sync` from the workspace root to compile buffered NDJSON into hive-partitioned Parquet and inspect the result in the dashboard at http://localhost:3000.

## Troubleshooting

- **No network request:** the dashboard must be running at `http://localhost:3000` (or whatever `VITE_FA_ENDPOINT` points to). Start it with `pnpm --filter dashboard dev` or `pnpm dev` from the root.
- **Overlay not showing:** it only renders on `localhost` / `127.0.0.1` when `debug: true`. In production builds it is never included.
- **No `data-fa-comp` in the DOM:** confirm the dev server restarted after editing `vite.config.ts`; the plugin runs with `enforce: 'pre'` before `@vitejs/plugin-react`.
