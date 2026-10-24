# HERO-HOST Slice2 — 黄忠 / 马超 / 诸葛亮 / 周瑜头像与半身工程挂载证据

工程分支自 [Draft #1069](https://github.com/anitaguptaoffice/sanguo-slg/pull/1069) @ `4af5abdccf9f882db0123ffb37753c24322be90e` 路径复制 **17 文件**（16 PNG + `manifest.json` 八条 `slice:2` 条目），**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=4af5abdccf9f882db0123ffb37753c24322be90e \
  node scripts/capture-hero-host-slice2-evidence.mjs
```

产物：`runtime/{1005,1006,1007,1008}/*`、`CHECKLIST.md`。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1005 node scripts/capture-hero-host-slice2-evidence.mjs
```
