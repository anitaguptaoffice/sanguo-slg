# HERO-HOST-REAL-001 — 主城真实将领中心面板挂载验收

工程在 **真实** 主城 HUD 路径打开 `data-center-panel="hero"`（非清空 `body` 的 fixture，亦非手工拼 panel）。占位 PNG 见 [hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)；名字在 bust **右侧**，底边 16px 为画布呼吸区。

## 捕获证据

```bash
cd client && npx playwright install chromium
node scripts/capture-hero-host-real-001-evidence.mjs
```

产物：`runtime/*.jpg`、`runtime/INVENTORY.md`、`runtime/probe-log.json`（`capture_mode: live-main-city-hero-panel`、真实 `uiScale` 与视口；**不**宣称联合冻结）。

历史占位卡 fixture 脚本（**非**本 gate）：`capture-hero-host-placeholder-001-fixture-evidence.mjs`。
