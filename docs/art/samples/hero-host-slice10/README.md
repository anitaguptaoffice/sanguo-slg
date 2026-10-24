# HERO-HOST Slice10 — 邓艾 / 孙策 / 孙坚 / 貂蝉工程挂载（1037–1040）

工程分支自 [Draft #1207](https://github.com/anitaguptaoffice/sanguo-slg/pull/1207) @ `c62723ae2c9fd4b466b5a90036673f1d71a067ef` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:10` 条目，**不合并**美术 Draft。

生产宿主布局与探针严格度继承 Slice9 工程挂载 [#1235](https://github.com/anitaguptaoffice/sanguo-slg/pull/1235)（基线 `a23b7ade43cf0711ddc778f5589046a547c23a5d`）；本卡仅挂载 1037–1040。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

明细见 `CHECKLIST.md` 与各 `runtime/{1037..1040}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=c62723ae2c9fd4b466b5a90036673f1d71a067ef \
  node scripts/capture-hero-host-slice10-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1037 node scripts/capture-hero-host-slice10-evidence.mjs
```
