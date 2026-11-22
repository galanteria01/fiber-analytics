# Demo script — 2-minute walkthrough

A timed, step-by-step script for recording a demo video or GIF, or for walking someone through FiberAnalytics live. Total runtime is about two minutes at a natural pace.

## Before you start

1. Install and build (or reuse an existing setup):

   ```bash
   pnpm install
   pnpm build:packages
   ```

2. Start the demo + dashboard together:

   ```bash
   pnpm dev
   ```

   This boots the demo at <http://localhost:5173> and the dashboard at <http://localhost:3000>.

3. Prep your browser:

   - Open a clean profile or an incognito window so `sessionStorage` starts fresh.
   - Size the window to roughly 1280 x 800 so both the app and the dashboard fit comfortably in a recording.
   - Enable the browser SDK overlay — it is on by default in debug mode on `localhost` and appears as a floating panel in the bottom-right corner of the demo.

4. (Optional, for narration) Keep a terminal visible where you can run `pnpm sync` on cue.

---

## The walkthrough

Times are approximate. Aim for steady, unhurried actions with a one-beat pause after each.

### 0:00 — Introduce the setup (10s)

> "This is FiberAnalytics. The app on the left is the demo — every interactive element is already tagged at build time. The panel floating in the corner is the live event overlay. The dashboard on the right starts empty; we will fill it."

- Show both tabs side by side: demo (`:5173`) and dashboard (`:3000`).

### 0:10 — Click a button (15s)

- On the demo home view (`/`), click **Browse products**.
- Call out the overlay: a new `click` row appears showing `component_name`, the `label` prop (`cta-shop`), and the source location `HomeView.tsx:…`.
- Point out the automatic `page_view` that follows the SPA navigation to `/products`.

### 0:25 — Submit a form (15s)

- On `/products`, use the sidebar **Filters** — toggle a checkbox or pick a sort option.
- Then fill the **Search** bar at the top and hit Enter (or press the submit button).
- In the overlay, highlight:
  - `state_change` events from the filter controls.
  - an `input` event (debounced) and a `submit` from the search form.
- Mention: "Inputs capture only primitive, safelisted props — no passwords or tokens."

### 0:40 — Open the modal (15s)

- Navigate back to `/` (via the nav bar or the browser back button — both emit a `page_view`).
- Click **Open modal**.
- Note the `view` event as the modal mounts, then click **Confirm upgrade** to close it and emit a `state_change`/`click`.
- This shows view-visibility tracking and state transitions in one interaction.

### 0:55 — Navigate routes (15s)

- Walk through the remaining routes — `/pricing` and `/settings` — using the nav bar.
- On each navigation, watch the overlay append a `page_view` with the new `url_path`.
- Optional: on the settings view, toggle the **Theme** selector to produce a `state_change` plus a custom `theme_changed` event via `track()`.
- By now the overlay should hold 12-20 events across multiple page views — a full session journey.

### 1:10 — Inspect the overlay (10s)

- Hover or expand an event row in the overlay to show its payload: `event_id`, `session_id`, `seq`, `component_name`, `properties`, and `source_loc`.
- Emphasise: "Every event carries which component fired, which props mattered, and exactly where in source it lives — with no hand-written tracking code."

### 1:20 — Run `pnpm sync` (15s)

- Switch to the terminal and run:

  ```bash
  pnpm sync
  ```

- Narrate: "This flushes buffered NDJSON from object storage into hive-partitioned Parquet — `domain/year/month/day` — deduplicating by `event_id`. For the local stack this is instant; in production a worker does it on a schedule."
- If recording, show the terminal output: number of files compiled and partitions written.

### 1:35 — Open the dashboard session timeline (25s)

- Switch to the dashboard at <http://localhost:3000>.
- On the **Overview** tab, point to the top-components chart and event-type breakdown — already populated from the sync.
- Click **Sessions** in the header. A new session row appears with device icon, page depth, and duration.
- Click into that session to open `/sessions/[id]` — the per-session journey timeline.
- Walk down the timeline: grouped by `pageview_id`, each entry shows the event type badge, component name, prop snapshot, and a `file:line:col` link back to source. Highlight how `Browse products` → `page_view /products` → search/filter events reads as a coherent journey.
- Optionally click **Paths** to show the aggregated "most common page sequences" bar chart.

---

## Wrap (optional tag)

> "That is FiberAnalytics: auto-tagged components, cookieless session journeys, Parquet you own, and a dashboard that queries it with DuckDB — all running on your infrastructure."

## Tips for recording

- Use a screen recorder at 1080p; keep system notifications muted.
- If making a GIF, record once at full length then trim to the 0:10-1:35 highlights. See [docs/assets/README.md](assets/README.md) for export settings.
- Redact or blur any real secrets if you switch from `local` to `s3` storage during the demo.
- If the dashboard shows "No data yet" after `pnpm sync`, check that `FA_STORAGE` matches between the dashboard and the worker, and that the Parquet glob (`analytics/**/*.parquet`) is non-empty.
