# HERO-HOST Slice4 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha（1013/1015/1016）** | `cc9da5f28492bbbcb8d82d87458041d685726661` | Draft [#1192](https://github.com/anitaguptaoffice/sanguo-slg/pull/1192)；**勿合并** |
| **art_head_sha（1014）** | `11f87490181675293bc07ec1e4772a50624c1867` | #1192 @ 11f87490 路径复制；**勿合并** |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（含 list-avatar clip-aware 1600 捕获） |

## 范围

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1013..1016}.v1` + bust |
| 未合并 #1191/#1192/#1193/#1069/#1017/#108/#983/#697/#77/#82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster-slice4`） | PASS | mock 种子含 1014 |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | 1014 重拍；1013/1015/1016 沿用 prior 像素 |
| 1280 sameframe / 详情末尾 | PASS | 未重拍 sameframe |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1013 | 张辽 | `docs/art/samples/hero-host-slice4/runtime/1013/` |
| 1014 | 陆逊 | `docs/art/samples/hero-host-slice4/runtime/1014/` |
| 1015 | 曹仁 | `docs/art/samples/hero-host-slice4/runtime/1015/` |
| 1016 | 典韦 | `docs/art/samples/hero-host-slice4/runtime/1016/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice4-evidence.mjs
# 仅重拍 1600（保留 1280 / sameframe）：
# SKIP_SAMEFRAME=1 SKIP_1280_VIEWPORT=1 HERO_TEMPLATE_CFG_ID=1014 node scripts/capture-hero-host-slice4-evidence.mjs
```
