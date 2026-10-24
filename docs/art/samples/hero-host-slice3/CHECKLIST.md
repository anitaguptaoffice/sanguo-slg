# HERO-HOST Slice3 工程挂载验收（#108 编排用）

## HOLD（不签收）

| template_cfg_id | 名称 | 状态 |
|---|---|---|
| 1009 | 曹操 | **FAIL / HOLD** — 无路径复制、无 runtime 证据 |
| 1010 | 孙权 | **FAIL / HOLD** — 无路径复制、无 runtime 证据 |

详见 [HOLD-1009-1010.md](./HOLD-1009-1010.md)。

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `320955f1ff4565b161268640226bf3d4156d4f17` | Draft [#1191](https://github.com/anitaguptaoffice/sanguo-slg/pull/1191) 路径复制源（**仅 1011/1012**）；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见 `runtime/1011`、`runtime/1012` 的 `probe-log.json` | 工程挂载 PR HEAD |

## 范围（1011 / 1012）

| 项 | 结果 | 备注 |
|---|---|---|
| 2 template / 4 manifest ID / 8 PNG | PASS | `hero.avatar.{1011,1012}.v1` + `hero.bust.*` |
| 未合并 #1191 / #1192 / #1193 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1 / DPR2 / 1280 详情末尾 | PASS | 每将领 `runtime/{id}/` |
| 1280 bust+name **sameframe** | **FAIL / pending host fix** | 见 [SAMEFRAME-PENDING-HOST-FIX.md](./SAMEFRAME-PENDING-HOST-FIX.md)；#108 6388032901 |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |
| 面部静态 ≥60% | PASS | 不适用 1001 ≥57% 特例 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1011 | 吕布 | `docs/art/samples/hero-host-slice3/runtime/1011/` |
| 1012 | 司马懿 | `docs/art/samples/hero-host-slice3/runtime/1012/` |

## 重跑捕获

```bash
cd client && ART_HEAD_SHA=320955f1ff4565b161268640226bf3d4156d4f17 \
  node scripts/capture-hero-host-slice3-evidence.mjs
```
