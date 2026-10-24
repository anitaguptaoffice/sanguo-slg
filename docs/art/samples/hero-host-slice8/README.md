# HERO-HOST Slice8 — 夏侯惇 / 夏侯渊 / 张郃 / 徐晃工程挂载（1029–1032）

工程分支自 [Draft #1205](https://github.com/anitaguptaoffice/sanguo-slg/pull/1205) @ `181b0191b834b2e0c3a983a7911690552fe143f0` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:8` 条目，**不合并**美术 Draft。

生产宿主布局与探针严格度继承 Slice7 工程挂载 [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) @ `035abdda48bdfab8bac44837c72afea76e9eae68`；Slice7 已在 #108 签收路径，本卡仅挂载 1029–1032。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

明细见 `CHECKLIST.md` 与各 `runtime/{1029..1032}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=181b0191b834b2e0c3a983a7911690552fe143f0 \
  node scripts/capture-hero-host-slice8-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1029 node scripts/capture-hero-host-slice8-evidence.mjs
```
