# HERO-HOST Slice4 — 张辽 / 陆逊 / 曹仁 / 典韦头像与半身工程挂载证据

工程分支自 [Draft #1192](https://github.com/anitaguptaoffice/sanguo-slg/pull/1192) @ `cc9da5f28492bbbcb8d82d87458041d685726661` 路径复制 **16 PNG** + `manifest.json` 八条 `slice:4` 条目，**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=cc9da5f28492bbbcb8d82d87458041d685726661 \
  node scripts/capture-hero-host-slice4-evidence.mjs
```

产物：`runtime/{1013,1014,1015,1016}/*`、`CHECKLIST.md`。Mock preset：`hero-panel-roster-slice4`（仅种子 8013–8016）。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1013 node scripts/capture-hero-host-slice4-evidence.mjs
```
