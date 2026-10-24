# HERO-HOST Slice4 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `cc9da5f28492bbbcb8d82d87458041d685726661` | Draft [#1192](https://github.com/anitaguptaoffice/sanguo-slg/pull/1192) 路径复制源；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（证据捕获时 `git rev-parse HEAD`） |
| **静态面部比例** | 1014 陆逊 60.06%（边界，保持当前裁切） | 其余见美术 Draft freeze；均 ≥60% |

## 范围

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1013,1014,1015,1016}.v1` + `hero.bust.*`；保留既有 1001–1008 |
| 未合并 #1191/#1192/#1193/#1069/#1017/#108/#983/#697/#77/#82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster-slice4`） | PASS | mock 仅种子 8013–8016 行 |
| 列表行：圆角头像 + 可读主名 | PASS | probe `listAvatarVisible` + `nameReadable` |
| 详情：半身 + 名右侧约 10px（`gapPx`） | PASS | 同帧图 `*-bust-name-sameframe.jpg` |
| 1600 DPR1 / 1600 DPR2 / 1280 详情末尾 | PASS | 每将领 `runtime/{id}/` |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1013 | 张辽 | `docs/art/samples/hero-host-slice4/runtime/1013/` |
| 1014 | 陆逊 | `docs/art/samples/hero-host-slice4/runtime/1014/` |
| 1015 | 曹仁 | `docs/art/samples/hero-host-slice4/runtime/1015/` |
| 1016 | 典韦 | `docs/art/samples/hero-host-slice4/runtime/1016/` |

每目录含：`hero-host-1600x900-dpr1.jpg`、`hero-host-1600x900-dpr2.jpg`、`hero-host-1280x720-dpr1.jpg`、`hero-host-1280x720-dpr1-bust-name-sameframe.jpg`、`probe-log.json`、`INVENTORY.md`。

## 重跑捕获

```bash
cd client && ART_HEAD_SHA=cc9da5f28492bbbcb8d82d87458041d685726661 \
  node scripts/capture-hero-host-slice4-evidence.mjs
```
