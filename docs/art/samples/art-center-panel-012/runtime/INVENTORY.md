# INVENTORY — ART-CENTER-PANEL-012 runtime

Runtime code at capture: `73e40d066b6b06015adfc19fdd9bd0fafc48fd29` (mock + client; must resolve on GitHub).
Screenshot JPEGs / probe-log land in a follow-up git commit — after push, set `screenshot_artifacts_commit_sha` in `probe-log.json` to that commit (often same as runtime when captured on a clean checkout).
Art PNGs from Draft #697 @ `bcf05c7365f92f17142f4ce25a3ba1bdd2b80247` (**not merged**).

## Asset contract

| asset_id | 1× path | 2× path | display | nine_slice |
|---|---|---|---|---|
| `ui.panel.hero.v1` | `textures/1x/ui/panel_hero.png` | `textures/2x/ui/panel_hero.png` | 320×200 | 24 L/T/R/B |

## Runtime JPEG (<1MB each)

| File | Viewport | Notes |
|---|---|---|
| `hero-center-panel-1600x900.jpg` | 1600×900 DPR1 | 将领中心面板（列表+详情） |
| `hero-center-panel-3200x1800.jpg` | 1600×900 DPR2 | 2× 纹理路径 `textures/2x/ui/panel_hero.png` |
| `hero-center-panel-1280x720.jpg` | 1280×720 DPR1 | 窄布局 `layout-narrow` |
| `hero-center-panel-1280x720-detail-scroll.jpg` | 1280×720 | `.panel-scroll-body` 滚至底部 |
| `hero-center-panel-3200x1800-detail-scroll.jpg` | 1600×900 DPR2 | 宽屏滚至详情末尾 |

## Checklist

- [x] panel_hero 1×/2× by DPR
- [x] nine-slice border-image mounted
- [x] no top color bar
- [x] detail inside scroll body
- [x] 1280 scroll reaches detail bottom
- [x] 1280 scroll detail footer reachable
- [x] paper muted readable
- [x] ink body readable
- [x] hero detail loaded (attrs table)
- [x] 1280 scroll shows real detail (not error)
- [x] 1600 detail not max-height clamped
- [x] 1600/DPR2 scroll body scrollable when detail overflows
- [x] 1600/DPR2 scroll reaches detail footer
- [x] 1280 scroll-bottom deficit hint readable on ink

Regenerate: `cd client && node scripts/capture-art-center-panel-012-evidence.mjs`

Probes: `probe-log.json`.

