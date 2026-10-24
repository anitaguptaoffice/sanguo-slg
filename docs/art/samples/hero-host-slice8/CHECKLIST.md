# HERO-HOST Slice8 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `181b0191b834b2e0c3a983a7911690552fe143f0` | Draft [#1205](https://github.com/anitaguptaoffice/sanguo-slg/pull/1205)；**勿合并** |
| **base_host_sha** | `035abdda48bdfab8bac44837c72afea76e9eae68` | Slice7 宿主 [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) |
| **evidence_head_sha / tip_sha / runtime_code_sha** | 见各 `probe-log.json`（与 #1234 证据 `HEAD` 一致） | 含 capture8、mock 1029–1032、runtime JPEG；**不在** `base_host_sha` |
| **capture_script_blob_sha** | 见各 `probe-log.json` | `capture-hero-host-slice8-evidence.mjs` git blob |
| **mock_blob_sha** | 见各 `probe-log.json` | `client/mock-server/server.mjs` git blob（含 1029–1032 种子） |
| **hero_mail_panels_blob_sha** | `356f8e33734ca1374f3cf1ecd61368431293a93c` | 与 `base_host_sha` 布局一致时不变 |
| **Slice7 已签收路径** | [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) | 1025–1028 不在本卡重复挂载 |

## 范围（1029–1032）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1029..1032}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 Slice7 既有 115 项 → 123 |
| PNG SHA256 对齐 #1205 正文 | PASS | 16/16 |
| 未合并 #1205 / #1206 / #1207 / #1233 / #108 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe bust+name | PASS | |
| 1280 detail footer scroll reach | PASS | `scrollReachOk` |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1029 | 夏侯惇 | `docs/art/samples/hero-host-slice8/runtime/1029/` |
| 1030 | 夏侯渊 | `docs/art/samples/hero-host-slice8/runtime/1030/` |
| 1031 | 张郃 | `docs/art/samples/hero-host-slice8/runtime/1031/` |
| 1032 | 徐晃 | `docs/art/samples/hero-host-slice8/runtime/1032/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice8-evidence.mjs
```
