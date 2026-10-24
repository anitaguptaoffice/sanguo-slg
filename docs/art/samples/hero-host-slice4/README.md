# HERO-HOST Slice4 — 张辽 / 曹仁 / 典韦工程挂载证据（1014 陆逊 HOLD）

工程分支自 [Draft #1192](https://github.com/anitaguptaoffice/sanguo-slg/pull/1192) @ `cc9da5f28492bbbcb8d82d87458041d685726661` 路径复制 **12 PNG** + `manifest.json` 六条 `slice:4` 条目，**不合并**美术 Draft。

**1014 陆逊**：**FAIL / HOLD** — 无 PNG/manifest/运行时证据，见 [HOLD-1014.md](./HOLD-1014.md)。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=cc9da5f28492bbbcb8d82d87458041d685726661 \
  node scripts/capture-hero-host-slice4-evidence.mjs
```

产物：`runtime/{1013,1015,1016}/*`、`CHECKLIST.md`。Mock preset：`hero-panel-roster-slice4`（种子 8013 / 8015 / 8016）。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1013 node scripts/capture-hero-host-slice4-evidence.mjs
```
