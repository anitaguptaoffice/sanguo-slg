# HERO-HOST Slice2 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `4af5abdccf9f882db0123ffb37753c24322be90e` | Draft [#1069](https://github.com/anitaguptaoffice/sanguo-slg/pull/1069) 路径复制源；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（证据捕获时 `git rev-parse HEAD`） |
| **静态面部比例** | 黄忠 61.90% / 马超 62.41% / 诸葛亮 62.11% / 周瑜 61.96% | 均 ≥60%（不适用 1001 的 ≥57% 特例）；美术源 #1069 freeze #108 |

## 范围

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1005,1006,1007,1008}.v1` + `hero.bust.*`；保留既有 1001–1004 |
| 未合并 #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | 禁止 layout-frame / `HERO_HOST_REAL_LAYOUT_MOUNT` |
| 列表行：圆角头像 + 可读主名 | PASS | probe `listAvatarVisible` + `nameReadable` |
| 详情：半身 + 名右侧约 10px（`gapPx`） | PASS | 同帧图 `*-bust-name-sameframe.jpg` |
| 1600 DPR1 / 1600 DPR2 / 1280 详情末尾 | PASS | 每将领 `runtime/{id}/` |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1005 | 黄忠 | `docs/art/samples/hero-host-slice2/runtime/1005/` |
| 1006 | 马超 | `docs/art/samples/hero-host-slice2/runtime/1006/` |
| 1007 | 诸葛亮 | `docs/art/samples/hero-host-slice2/runtime/1007/` |
| 1008 | 周瑜 | `docs/art/samples/hero-host-slice2/runtime/1008/` |

每目录含：`hero-host-1600x900-dpr1.jpg`、`hero-host-1600x900-dpr2.jpg`、`hero-host-1280x720-dpr1.jpg`、`hero-host-1280x720-dpr1-bust-name-sameframe.jpg`、`probe-log.json`、`INVENTORY.md`。

## 重跑捕获

```bash
cd client && ART_HEAD_SHA=4af5abdccf9f882db0123ffb37753c24322be90e \
  node scripts/capture-hero-host-slice2-evidence.mjs
```
