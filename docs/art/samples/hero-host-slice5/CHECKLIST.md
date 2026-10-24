# HERO-HOST Slice5 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha（1017/1018/1020）** | `9f15a34119c1bcb157399693a5420c0a2787a47a` | Draft [#1193](https://github.com/anitaguptaoffice/sanguo-slg/pull/1193)；**勿合并** |
| **art_head_sha（1019）** | `0b2b3987989fef0066bce8d728c54029b219cd55` | #1193 @ 0b2b3987 路径复制；**勿合并** |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（含 list-avatar clip-aware 1600 捕获） |

## 范围（1017–1020）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1017..1020}.v1` + bust |
| 未合并 #1193 / #1192 / #1191 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe | PASS | art 已签收；未重拍 |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | 1019 使用 #1193 新交付 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1017 | 许褚 | `docs/art/samples/hero-host-slice5/runtime/1017/` |
| 1018 | 黄忠 | `docs/art/samples/hero-host-slice5/runtime/1018/` |
| 1019 | 庞统 | `docs/art/samples/hero-host-slice5/runtime/1019/` |
| 1020 | 周瑜 | `docs/art/samples/hero-host-slice5/runtime/1020/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice5-evidence.mjs
# 仅重拍 1600：
# SKIP_SAMEFRAME=1 SKIP_1280_VIEWPORT=1 node scripts/capture-hero-host-slice5-evidence.mjs
```
