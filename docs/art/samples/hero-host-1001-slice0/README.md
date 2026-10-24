# HERO-HOST-1001 slice:0 — 刘备头像 / 半身工程挂载证据

工程分支自 [Draft #983](https://github.com/anitaguptaoffice/sanguo-slg/pull/983) @ `eef9514b` 路径复制 **5 文件**（4 PNG + `manifest.json` 标签 `slice:0`），**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
HERO_HOST_EVIDENCE_SAMPLE=hero-host-1001-slice0 \
  ART_HEAD_SHA=eef9514b507c3b21921987ab94232021422bdc2f \
  node scripts/capture-hero-host-placeholder-001-evidence.mjs
```

产物：`runtime/*.jpg`、`runtime/INVENTORY.md`、`runtime/probe-log.json`、`CHECKLIST.md`。
