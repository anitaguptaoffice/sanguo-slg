# HERO-HOST Slice3 — 曹操 / 孙权 / 吕布 / 司马懿头像与半身工程挂载证据

工程分支自 [Draft #1191](https://github.com/anitaguptaoffice/sanguo-slg/pull/1191) @ `320955f1ff4565b161268640226bf3d4156d4f17` 路径复制 **16 PNG** + `manifest.json` 八条 `slice:3` 条目（在既有 75 条基础上追加），**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=320955f1ff4565b161268640226bf3d4156d4f17 \
  node scripts/capture-hero-host-slice3-evidence.mjs
```

产物：`runtime/{1009,1010,1011,1012}/*`、`CHECKLIST.md`。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1009 node scripts/capture-hero-host-slice3-evidence.mjs
```
