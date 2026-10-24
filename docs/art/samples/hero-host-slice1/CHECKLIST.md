# HERO-HOST Slice1 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `d9d04ac15ded6e31c49139cb43afc28abe5a35b0` | Draft [#1017](https://github.com/anitaguptaoffice/sanguo-slg/pull/1017) 路径复制源；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（证据捕获时 `git rev-parse HEAD`） |
| **静态面部比例** | 关羽 67.37% / 张飞 60.61% / 赵云 61.13% | 均 ≥60%（不适用 1001 的 ≥57% 特例）；美术源 #1017 freeze #108 |

## 范围

| 项 | 结果 | 备注 |
|---|---|---|
| 3 template / 6 manifest ID / 12 PNG | PASS | `hero.avatar.{1002,1003,1004}.v1` + `hero.bust.*`；保留既有 1001 `slice:0` |
| 未合并 #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | 禁止 layout-frame / `HERO_HOST_REAL_LAYOUT_MOUNT` |
| 列表行：圆角头像 + 可读主名 | PASS | probe `listAvatarVisible` + `nameReadable` |
| 详情：半身 + 名右侧约 10px（`gapPx`） | PASS | 同帧图 `*-bust-name-sameframe.jpg` |
| 1600 DPR1 / 1600 DPR2 / 1280 详情末尾 | PASS | 每将领 `runtime/{id}/` |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1002 | 关羽 | `docs/art/samples/hero-host-slice1/runtime/1002/` |
| 1003 | 张飞 | `docs/art/samples/hero-host-slice1/runtime/1003/` |
| 1004 | 赵云 | `docs/art/samples/hero-host-slice1/runtime/1004/` |

每目录含：`hero-host-1600x900-dpr1.jpg`、`hero-host-1600x900-dpr2.jpg`、`hero-host-1280x720-dpr1.jpg`、`hero-host-1280x720-dpr1-bust-name-sameframe.jpg`、`probe-log.json`、`INVENTORY.md`。

## 重跑捕获

```bash
cd client && ART_HEAD_SHA=d9d04ac15ded6e31c49139cb43afc28abe5a35b0 \
  node scripts/capture-hero-host-slice1-evidence.mjs
```
