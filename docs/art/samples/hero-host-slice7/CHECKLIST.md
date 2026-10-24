# HERO-HOST Slice7 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `dea932332475ed1e3cf4f336693f3d4c12a6d903` | Draft [#1204](https://github.com/anitaguptaoffice/sanguo-slg/pull/1204)；**勿合并** |
| **runtime_code_sha / tip_sha** | `a083a52a146a5a743327c5c5751776380277fec7` | 生产 runtime（scroll/clip host + 招募区折叠）；见各 `probe-log.json` |
| **HeroMailPanels.ts blob** | `3b24f48c572902562d4d2fbc16a713a7ef9bae93` | 与 a083a52a capture 一致 |
| **evidence_head_sha** | 见本 eng PR `HEAD`（`cf76257c…`） | 证据 JPEG + `probe-log.json` 包 |
| **capture_helper_commit_sha** | `a083a52a146a5a743327c5c5751776380277fec7` | 捕获脚本提交；`probe-log.json` 内 `tip_sha` 同此 |
| **Slice6 已签收** | [#1228](https://github.com/anitaguptaoffice/sanguo-slg/pull/1228) @ `9f507b1d` | 1021–1024 不在本卡重复挂载 |

## 范围（1025–1028）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1025..1028}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 main 既有 75 项 |
| PNG SHA256 对齐 #1204 正文 | PASS | 16/16 |
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
