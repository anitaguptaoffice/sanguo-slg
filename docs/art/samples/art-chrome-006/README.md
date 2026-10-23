# ART-CHROME-006 client wire evidence

Asset source: art Draft PR #444 @ `85a2dec` (cherry-picked on eng branch only; **do not merge** #444).

**终验以 JPEG 为准**（每张 <1MB，完整 layout 帧含顶 HUD / 底工具栏，不裁切）。

## Full viewports (JPEG)

| File | Pixel size |
|------|------------|
| `maincity-1600x900-full.jpg` | 1600×900 |
| `maincity-3200x1800-full.jpg` | 3200×1800 (1600×900 viewport, DPR2) |
| `maincity-1280x720-full.jpg` | 1280×720 |

Legacy PNG (`*-dpr*-full.png`) 保留作历史对照，美术 connector 请取 JPEG。

## Frozen checklist (`states/`)

- `ui.button.toolbar.v1-{normal,hover,pressed,disabled}.jpg`
- `server-select-selected-enter-enabled.jpg`, `server-select-enter-disabled-failure.jpg`
- `building-sidebar-{upgradable,not-upgradable,error}.jpg` — 建筑侧栏 `ui.panel.default.v1`
- `military-panel-ui.panel.military.v1.jpg` — 军事表单 `ui.panel.military.v1`

## Hit proof

`hit-proof.json`: button / scroll container rects、裁切后可见交集、四角+中心 `elementFromPoint` 必须落在 `button` 上；末项滚动后点击证明。

工程：`ui.hud.bar.v1` / `ui.toolbar.bar.v1`；`ui.button.toolbar.v1`；`skinDefaultPanel` 建筑侧栏；`skinMilitaryPanel` 军事面板。

再生：`cd client && node scripts/capture-art-chrome-006-evidence.mjs`
