# HERO-HOST Slice7 — 华佗 / 蒋琬 / 太史慈 / 吕蒙工程挂载（1025–1028）

工程分支自 [Draft #1204](https://github.com/anitaguptaoffice/sanguo-slg/pull/1204) @ `dea932332475ed1e3cf4f336693f3d4c12a6d903` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:7` 条目，**不合并**美术 Draft。

Slice6 工程挂载 [#1228](https://github.com/anitaguptaoffice/sanguo-slg/pull/1228) 已在 #108 完成 runtime 美术签收；本卡仅挂载 1025–1028。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

明细见 `CHECKLIST.md` 与各 `runtime/{1025..1028}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=dea932332475ed1e3cf4f336693f3d4c12a6d903 \
  node scripts/capture-hero-host-slice7-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1025 node scripts/capture-hero-host-slice7-evidence.mjs
```
