# HERO-HOST Slice7 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `dea932332475ed1e3cf4f336693f3d4c12a6d903` | Draft [#1204](https://github.com/anitaguptaoffice/sanguo-slg/pull/1204)；**勿合并** |
| **runtime_code_sha / tip_sha** | 见各 `probe-log.json`（与证据提交 `HEAD` 一致） | 生产 runtime @ `e81a3840` 挂载 + 捕获脚本；[#108](https://github.com/anitaguptaoffice/sanguo-slg/issues/108) comment `6389564724` 证据缺口重拍 |
| **HeroMailPanels.ts blob** | `356f8e33734ca1374f3cf1ecd61368431293a93c` | 与当前 runtime 捕获一致 |
| **evidence_head_sha** | 见本 eng PR 证据提交 `HEAD` | JPEG + `probe-log.json` 包 |
| **capture_helper_commit_sha** | 与 `evidence_head_sha` 同提交（含 `hero-host-capture-probes*` 滚动/折叠修正） | |
| **Slice6 已签收** | [#1228](https://github.com/anitaguptaoffice/sanguo-slg/pull/1228) @ `9f507b1d` | 1021–1024 不在本卡重复挂载 |

## 范围（1025–1028）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1025..1028}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 main 既有 75 项 |
| PNG SHA256 对齐 #1204 正文 | PASS | 16/16（本 PR 未改 PNG） |
| 未合并 #1203–#1207 / #1191–#1193 / #1201 / #1195 / #1198 / #1228 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe bust+name | PASS | |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1025 | 华佗 | `docs/art/samples/hero-host-slice7/runtime/1025/` |
| 1026 | 蒋琬 | `docs/art/samples/hero-host-slice7/runtime/1026/` |
| 1027 | 太史慈 | `docs/art/samples/hero-host-slice7/runtime/1027/` |
| 1028 | 吕蒙 | `docs/art/samples/hero-host-slice7/runtime/1028/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice7-evidence.mjs
# 仅重拍 1600：
# SKIP_SAMEFRAME=1 SKIP_1280_VIEWPORT=1 node scripts/capture-hero-host-slice7-evidence.mjs
```
