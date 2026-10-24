# HERO-HOST Slice3 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha（1009/1010）** | `7c085cd1fd69c0d0d769d4e9191731e3bcc75bbc` | Draft [#1191](https://github.com/anitaguptaoffice/sanguo-slg/pull/1191) 路径复制；**勿合并** |
| **art_head_sha（1011/1012）** | `320955f1ff4565b161268640226bf3d4156d4f17` | 同批挂载源；**勿合并** Draft |
| **runtime_code_sha / tip_sha** | 见各 `runtime/{id}/probe-log.json` | 工程挂载 PR HEAD（含 list-avatar clip-aware 1600 捕获） |

## 范围（1009–1012）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1009..1012}.v1` + bust |
| 未合并 #1191 / #1192 / #1193 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1 / DPR2 列表头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 bust+name **sameframe** | PASS | art 已签收 #108 6388475118；未重拍 |
| 1280 详情末尾 | PASS | 沿用 prior matrix shot |
| DPR2 走 2× 纹理 | PASS | probe `usesAvatar2x` / `usesBust2x` @ dpr2 |
| 面部静态 ≥60% | PASS | 不适用 1001 ≥57% 特例 |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1009 | 曹操 | `docs/art/samples/hero-host-slice3/runtime/1009/` |
| 1010 | 孙权 | `docs/art/samples/hero-host-slice3/runtime/1010/` |
| 1011 | 吕布 | `docs/art/samples/hero-host-slice3/runtime/1011/` |
| 1012 | 司马懿 | `docs/art/samples/hero-host-slice3/runtime/1012/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice3-evidence.mjs
# 仅重拍 1600（保留 1280 / sameframe）：
# SKIP_SAMEFRAME=1 SKIP_1280_VIEWPORT=1 node scripts/capture-hero-host-slice3-evidence.mjs
```
