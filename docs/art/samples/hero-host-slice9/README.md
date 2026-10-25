# HERO-HOST Slice9 — 郭嘉 / 贾诩 / 法正 / 徐庶工程挂载（1033–1036）

工程分支自 [Draft #1206](https://github.com/anitaguptaoffice/sanguo-slg/pull/1206) @ `535ad943e90dd3cf26fd26510ee6b3999cdf6ba4` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:9` 条目，**不合并**美术 Draft。

生产宿主布局与探针严格度继承 Slice8 工程挂载 [#1234](https://github.com/anitaguptaoffice/sanguo-slg/pull/1234)（基线 Slice7 [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) @ `035abdda48bdfab8bac44837c72afea76e9eae68`）；本卡仅挂载 1033–1036。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

明细见 `CHECKLIST.md` 与各 `runtime/{1033..1036}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=535ad943e90dd3cf26fd26510ee6b3999cdf6ba4 \
  node scripts/capture-hero-host-slice9-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1033 node scripts/capture-hero-host-slice9-evidence.mjs
```
