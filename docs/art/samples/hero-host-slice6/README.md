# HERO-HOST Slice6 — 鲁肃 / 黄盖 / 魏延 / 姜维工程挂载（1021–1024）

工程分支自 [Draft #1203](https://github.com/anitaguptaoffice/sanguo-slg/pull/1203) @ `8035dfb59b3e783cd033b72d07bded3f4d3da483` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:6` 条目，**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

明细见 `CHECKLIST.md` 与各 `runtime/{1021..1024}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=8035dfb59b3e783cd033b72d07bded3f4d3da483 \
  node scripts/capture-hero-host-slice6-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1021 node scripts/capture-hero-host-slice6-evidence.mjs
```
