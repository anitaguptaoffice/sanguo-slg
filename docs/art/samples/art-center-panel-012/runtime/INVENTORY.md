# INVENTORY — ART-CENTER-PANEL-012 runtime

Captured at git `60fdd24342794754170d0b6948c32bca1db82a07`. Art PNGs from Draft #697 @ `bcf05c7365f92f17142f4ce25a3ba1bdd2b80247` (**not merged**).

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

## Checklist

- [x] panel_hero 1×/2× by DPR
- [x] nine-slice border-image mounted
- [x] no top color bar
- [x] detail inside scroll body
- [x] 1280 scroll reaches detail bottom
- [x] paper muted readable
- [x] ink body readable

Regenerate: `cd client && node scripts/capture-art-center-panel-012-evidence.mjs`

Probes: `probe-log.json`.

