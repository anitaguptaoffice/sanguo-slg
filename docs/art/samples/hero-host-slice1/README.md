# HERO-HOST Slice1 — 关羽 / 张飞 / 赵云头像与半身工程挂载证据

工程分支自 [Draft #1017](https://github.com/anitaguptaoffice/sanguo-slg/pull/1017) @ `d9d04ac15ded6e31c49139cb43afc28abe5a35b0` 路径复制 **13 文件**（12 PNG + `manifest.json` 六条 `slice:1` 条目），**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=d9d04ac15ded6e31c49139cb43afc28abe5a35b0 \
  node scripts/capture-hero-host-slice1-evidence.mjs
```

产物：`runtime/{1002,1003,1004}/*`、`CHECKLIST.md`。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1002 node scripts/capture-hero-host-slice1-evidence.mjs
```
