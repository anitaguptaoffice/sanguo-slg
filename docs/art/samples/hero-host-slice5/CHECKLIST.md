# HERO-HOST Slice5 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `9f15a34119c1bcb157399693a5420c0a2787a47a` | Draft [#1193](https://github.com/anitaguptaoffice/sanguo-slg/pull/1193) 路径复制源（**仅 1017/1018/1020**）；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（证据捕获时 `git rev-parse HEAD`） |

## 1019 庞统 — HOLD（不签收）

| 项 | 结果 | 备注 |
|---|---|---|
| 静态高清面部 | **FAIL** | **59.33% &lt; 60%**（#108 comment 6387959088 / shabby） |
| 工程挂载 | **HOLD** | 无 PNG、无 manifest；见 [HOLD-1019.md](./HOLD-1019.md) |
| 合并 #1193 | **禁止** | 等美术新固定 HEAD |

## 可挂载范围（1017 / 1018 / 1020）

| 项 | 结果 | 备注 |
|---|---|---|
| 3 template / 6 manifest ID / 12 PNG | PASS | `hero.avatar.{1017,1018,1020}.v1` + `hero.bust.*` |
| 未合并 #1193 / #1192 / #1191 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制；#1193 保持 Draft |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | 禁止 layout-frame / `HERO_HOST_REAL_LAYOUT_MOUNT` |
| 列表行：圆角头像 + 可读主名 | PASS | probe `listAvatarVisible` + `nameReadable` |
| 详情：半身 + 名右侧约 10px（`gapPx`） | PASS | 同帧图 `*-bust-name-sameframe.jpg` |
| 1600 DPR1 / 1600 DPR2 / 1280 详情末尾 | PASS | 每将领 `runtime/{id}/` |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |
| 面部 ≥60% / 半身顶≥12 底≥16 / anchor(64,152) | PASS | 契约同 Slice1/2；1019 不适用 |

## 每将领产物

| template_cfg_id | 名称 | 状态 | 证据目录 |
|---|---|---|---|
| 1017 | 许褚 | PASS | `docs/art/samples/hero-host-slice5/runtime/1017/` |
| 1018 | 荀彧 | PASS | `docs/art/samples/hero-host-slice5/runtime/1018/` |
| 1019 | 庞统 | **HOLD** | [HOLD-1019.md](./HOLD-1019.md) |
| 1020 | 甘宁 | PASS | `docs/art/samples/hero-host-slice5/runtime/1020/` |

每 PASS 目录含：`hero-host-1600x900-dpr1.jpg`、`hero-host-1600x900-dpr2.jpg`、`hero-host-1280x720-dpr1.jpg`、`hero-host-1280x720-dpr1-bust-name-sameframe.jpg`、`probe-log.json`、`INVENTORY.md`。

## 重跑捕获（不含 1019）

```bash
cd client && ART_HEAD_SHA=9f15a34119c1bcb157399693a5420c0a2787a47a \
  node scripts/capture-hero-host-slice5-evidence.mjs
```
