# HERO-HOST 1280×720 俘虏/结交/来投按钮 clip 回归证据

工程修复：[PR #1237](https://github.com/anitaguptaoffice/sanguo-slg/pull/1237)（merge `12f06e78230fce6cf017f399fbcbb26d10778f98`）。

本目录为 **#108 专用** 的 1280 窄屏三列操作钮「完整落在可见 clip 内」证据，**不是** `hero-host-slice10` 等角色批次矩阵签收图。

## 重跑

```bash
cd client && npx playwright install chromium
node scripts/capture-hero-host-1280-capture-buttons-evidence.mjs
```

产出：`runtime/hero-host-1280x720-dpr1.jpg`、`runtime/hero-host-1280x720-dpr1-capture-sections.jpg`、`runtime/probe-log.json`、`INVENTORY.md`。

验收：`probe-log.json` → `probes["1280x720-dpr1"].captureSectionButtonsInClip.ok === true`。

若 main tip 的 Vite 图因 wave49 错误导入无法启动，可按 `probe-log.json` 的 `capture_runtime_checkout_sha` 检出宿主再跑，并将 tip 的 `client/index.html` 覆盖到该检出（俘虏三列 CSS 自 #1237 起未再改）。

## 影响范围

仅主城将领宿主 chrome（`layout-narrow` 下 `hero-capture-sections-row`）；40/40 角色贴图与 Slice 矩阵不变。
