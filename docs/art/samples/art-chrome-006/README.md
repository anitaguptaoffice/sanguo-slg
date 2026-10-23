# ART-CHROME-006 client wire evidence

Asset source: art Draft PR #444 @ `85a2dec` (cherry-picked on eng branch only).

## Screenshots

| File | Viewport |
|------|----------|
| `maincity-1600x900-dpr1-full.png` | 1600×900 DPR1 idle main city |
| `maincity-1600x900-dpr2-full.png` | 1600×900 DPR2 idle main city |
| `maincity-1280x720-dpr1-full.png` | 1280×720 DPR1 idle main city |

## Scroll / hit

See `measurements.json` for `scrollMetrics`, `lastEntryReachableAfterScroll`, and per-button CSS hit rects.

Engineering: `ui.hud.bar.v1` / `ui.toolbar.bar.v1` DOM skins; `ui.button.toolbar.v1` on toolbar buttons; `.toolbar-scroll` horizontal overflow; `.toolbar-btn-hit` expands screen CSS hit to ≥44px at 1280×720.
