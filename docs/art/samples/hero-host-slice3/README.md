# HERO-HOST Slice3 — 吕布 / 司马懿（1011–1012）工程挂载证据

**1009 曹操 / 1010 孙权：FAIL / HOLD** — 见 [HOLD-1009-1010.md](./HOLD-1009-1010.md)。本 PR **不**挂载、不采证二者。

工程分支自 [Draft #1191](https://github.com/anitaguptaoffice/sanguo-slg/pull/1191) @ `320955f1ff4565b161268640226bf3d4156d4f17` 路径复制 **8 PNG**（1011/1012）+ `manifest.json` **四条** `slice:3` 条目（75→79），**不合并**美术 Draft。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=320955f1ff4565b161268640226bf3d4156d4f17 \
  node scripts/capture-hero-host-slice3-evidence.mjs
```

产物：`runtime/{1011,1012}/*`、`CHECKLIST.md`。

**1280 bust+name 同帧**：`FAIL_PENDING_HOST_FIX`（#108 6388032901）— 见 [SAMEFRAME-PENDING-HOST-FIX.md](./SAMEFRAME-PENDING-HOST-FIX.md)。勿将同帧 JPEG 当作签收依据。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1011 node scripts/capture-hero-host-slice3-evidence.mjs
```
