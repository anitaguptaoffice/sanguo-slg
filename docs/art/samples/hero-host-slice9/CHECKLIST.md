# HERO-HOST Slice9 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `535ad943e90dd3cf26fd26510ee6b3999cdf6ba4` | Draft [#1206](https://github.com/anitaguptaoffice/sanguo-slg/pull/1206)；**勿合并** |
| **base_host_sha** | `28c1d9ac92cfa45e5f957a96c572270ddfedb6c6` | Slice8 宿主 [#1234](https://github.com/anitaguptaoffice/sanguo-slg/pull/1234) |
| **runtime_code_sha / tip_sha** | 见各 `probe-log.json`（与证据提交 `HEAD` 一致） | |
| **HeroMailPanels.ts blob** | 见各 `probe-log.json` | 与当前 runtime 捕获一致 |
| **Slice8 已签收路径** | [#1234](https://github.com/anitaguptaoffice/sanguo-slg/pull/1234) | 1029–1032 不在本卡重复挂载 |

## 范围（1033–1036）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1033..1036}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 Slice8 既有 123 项 → 131 |
| PNG SHA256 对齐 #1206 正文 | PASS | 16/16 |
| 未合并 #1206 / #1234 / #108 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe bust+name | PASS | |
| 1280 detail footer scroll reach | PASS | `scrollReachOk` |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1033 | 郭嘉 | `docs/art/samples/hero-host-slice9/runtime/1033/` |
| 1034 | 贾诩 | `docs/art/samples/hero-host-slice9/runtime/1034/` |
| 1035 | 法正 | `docs/art/samples/hero-host-slice9/runtime/1035/` |
| 1036 | 徐庶 | `docs/art/samples/hero-host-slice9/runtime/1036/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice9-evidence.mjs
```
