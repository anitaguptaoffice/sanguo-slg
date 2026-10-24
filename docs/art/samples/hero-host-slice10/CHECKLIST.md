# HERO-HOST Slice10 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `c62723ae2c9fd4b466b5a90036673f1d71a067ef` | Draft [#1207](https://github.com/anitaguptaoffice/sanguo-slg/pull/1207)；**勿合并** |
| **base_host_sha** | `a23b7ade43cf0711ddc778f5589046a547c23a5d` | Slice9 宿主 [#1235](https://github.com/anitaguptaoffice/sanguo-slg/pull/1235) |
| **evidence_head_sha / runtime_code_sha / tip_sha** | 见各 `probe-log.json`（与证据提交 `HEAD` 一致） | |
| **HeroMailPanels.ts blob** | 见各 `probe-log.json` | 与当前 runtime 捕获一致 |
| **Slice9 已签收路径** | [#1235](https://github.com/anitaguptaoffice/sanguo-slg/pull/1235) | 1033–1036 不在本卡重复挂载 |

## 范围（1037–1040）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1037..1040}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 Slice9 既有 131 项 → 139 |
| PNG SHA256 对齐 #1207 正文 | PASS | 16/16 |
| 未合并 #1207 / #1235 / #108 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe bust+name | PASS | |
| 1280 detail footer scroll reach | PASS | `scrollReachOk` |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1037 | 邓艾 | `docs/art/samples/hero-host-slice10/runtime/1037/` |
| 1038 | 孙策 | `docs/art/samples/hero-host-slice10/runtime/1038/` |
| 1039 | 孙坚 | `docs/art/samples/hero-host-slice10/runtime/1039/` |
| 1040 | 貂蝉 | `docs/art/samples/hero-host-slice10/runtime/1040/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice10-evidence.mjs
```
