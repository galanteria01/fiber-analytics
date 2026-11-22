# Assets

How to capture screenshots and GIFs for the README and npm package pages. No binary assets are committed in this repository — generate them locally during verification and attach them where you publish (GitHub release, npm, docs site).

## Prerequisites

```bash
pnpm install
pnpm build:packages
pnpm dev        # demo on http://localhost:5173, dashboard on http://localhost:3000
```

Optional but recommended:

- A clean browser profile or incognito window (fresh `sessionStorage`).
- A 1280 x 800 or 1440 x 900 viewport so captures match typical README widths.
- Light or dark OS theme — match whatever your dashboard's `globals.css` targets; README screenshots should use one theme consistently.

Seed data before capturing dashboard shots:

```bash
# interact with the demo (see docs/demo-script.md), then:
pnpm sync
```

The sync step is required — the dashboard reads Parquet under `analytics/**/*.parquet`, so without it the overview/sessions/timeline/pages will show "No data yet."

## What to capture

### Demo app (`:5173`)

| Shot                      | What it shows                                              | How                                                                                                       |
| ------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `demo-home.png`           | Home view hero + controls + live overlay with a few events | Open `/`, click a counter button and the Like button, ensure the overlay in the bottom-right has 3-5 rows |
| `demo-overlay-detail.png` | Expanded event payload in the overlay                      | Hover or expand one event row to reveal `component_name`, `properties`, `source_loc`                      |
| `demo-products.png`       | Products view with filter panel + product grid             | Navigate to `/products`, toggle a filter so the panel looks active                                        |
| `demo-modal.png`          | Modal open over a dimmed backdrop                          | On `/`, click **Open modal** and capture before dismissing                                                |

### Dashboard (`:3000`)

| Shot                     | What it shows                                                        | How                                                                                                               |
| ------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `dashboard-overview.png` | Overview tab: summary cards, event breakdown, funnel, top components | Ensure `pnpm sync` has run and the seeded session covers 2-3 page views                                           |
| `dashboard-sessions.png` | Sessions list table with at least one session                        | Visit `/sessions` after sync; capture the full table including device icon and duration                           |
| `dashboard-timeline.png` | Per-session journey timeline grouped by `pageview_id`                | Click into a session at `/sessions/[id]`; scroll so 6-10 events are visible with type badges and source locations |
| `dashboard-paths.png`    | Path analysis bars                                                   | Visit `/paths`; capture the "most common sequences" list with at least 2-3 paths                                  |

All six to eight shots are the recommended set for a polished README. If you can only do four, prioritise `demo-home.png`, `dashboard-overview.png`, `dashboard-sessions.png`, and `dashboard-timeline.png`.

## Screenshot capture

1. Set the browser to the target width (1280 x 800) so captures have consistent aspect ratios.
2. Use your OS capture (e.g. `Cmd+Shift+4` on macOS, `PrtScn` / Snipping Tool on Windows, `gnome-screenshot` on Linux) or Chrome DevTools' **Capture screenshot** / **Capture full size screenshot** command.
3. Save as PNG at native resolution (no downscaling). Aim for files under 800 KB each — run them through an optimiser if needed:

   ```bash
   # one-off optimisation (requires pngquant or similar)
   npx --yes imagemin-cli "shots/*.png" --out-dir=shots --plugin=pngquant
   ```

4. Do not commit the PNGs to the repo. Upload them as GitHub release assets or attach them to the documentation site, then reference by URL in the README.

## GIF capture

A single 20-40 second GIF covering click → form → modal → sync → session timeline is the most effective README asset. Use the timeline in [docs/demo-script.md](../demo-script.md) for the script.

### Recommended setup

- Record at roughly 900 x 520 so the GIF stays under GitHub's 10 MB rendering cap.
- Capture at 10-12 fps; higher frame rates rarely improve readability and bloat the file.

### Tools

macOS / cross-platform:

```bash
# Record with QuickTime or Kap, then convert with ffmpeg + gifski:
ffmpeg -i input.mov -vf "fps=12,scale=900:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse" -loop 0 demo.gif
# or, for higher quality at similar size:
ffmpeg -i input.mov -r 12 -vf scale=900:-1 demo-%04d.png
gifski -o demo.gif demo-*.png --width 900 --fps 12 --quality 80
```

Linux:

```bash
# Record with peek, obs-studio, or ffmpeg x11grab, then the same gifski step above.
ffmpeg -f x11grab -video_size 1280x800 -i :0.0 -r 12 -t 35 demo.mov
# then encode to GIF as above
```

Windows:

- Use ScreenToGif or ShareX to record and export directly; cap at 900 px wide, 12 fps, 35 seconds max.

### Quality checks

- Verify the GIF loops cleanly and text stays readable (especially component names and `source_loc` in the overlay/timeline).
- Keep the final GIF under 5-6 MB if embedding in the README; link to a full-resolution video externally if you want longer demonstrations.
- Do not commit the GIF to the repo. Attach it to a GitHub release or host it externally and link by URL.

## Naming and references

When you prepare a release that includes visuals, use these paths as the upload targets (adjust to your release host):

```
assets/demo-home.png
assets/demo-overlay-detail.png
assets/demo-products.png
assets/demo-modal.png
assets/dashboard-overview.png
assets/dashboard-sessions.png
assets/dashboard-timeline.png
assets/dashboard-paths.png
assets/demo-flow.gif
```

In `README.md`, reference them by their published URLs, for example:

```markdown
![Dashboard overview](https://github.com/galanteria01/fiber-analytics/releases/download/v0.1.0/dashboard-overview.png)
![Demo flow](https://github.com/galanteria01/fiber-analytics/releases/download/v0.1.0/demo-flow.gif)
```

## Checklist before publishing

- [ ] Demo overlay is visible and seeded with representative events
- [ ] Dashboard has at least one synced session (run `pnpm sync`; check `/api/health` returns 200)
- [ ] All screenshots use the same theme and viewport width
- [ ] PNGs are optimised (< 800 KB each) and stored outside the repo (release assets or external host)
- [ ] GIF is < 6 MB, 900 px wide, 12 fps, and loops cleanly
- [ ] README / npm page links use the published URLs, not local paths
