# HERO-HOST-PLACEHOLDER-001 — 将领列表头像 / 详情半身工程占位框

工程挂载 `hero.avatar.1001.v1` / `hero.bust.1001.v1`（品红棋盘占位 PNG，**非**生产美术）。契约见 [hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)。

## 捕获证据

```bash
cd client && npx playwright install chromium
node scripts/capture-hero-host-placeholder-001-fixture-evidence.mjs
```

产物：`runtime/*.jpg`、`runtime/INVENTORY.md`、`runtime/probe-log.json`（含 CSS 框尺寸、`uiScale`、1×/2× 纹理路径）。

可选全链路 mock 主城（环境支持时）：

```bash
node scripts/capture-hero-host-placeholder-001-evidence.mjs
```
