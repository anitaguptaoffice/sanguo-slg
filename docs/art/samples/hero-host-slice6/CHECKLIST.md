# HERO-HOST Slice6 工程挂载验收（#108 编排用）

## SHA 分列（禁止混用）

| 字段 | 值 | 说明 |
|---|---|---|
| **art_head_sha** | `8035dfb59b3e783cd033b72d07bded3f4d3da483` | Draft [#1203](https://github.com/anitaguptaoffice/sanguo-slg/pull/1203)；**勿合并** |
| **runtime_code_sha / tip_sha** | `d2cf1a1841dfbdcdb14d15698297b701a7acdcda` | 生产 runtime（scroll/clip host + 招募区折叠）；见各 `probe-log.json` |
| **HeroMailPanels.ts blob** | `642db6d4a46cdebd5dd77b5279bc56b52080018a` | 与 d2cf1a18 capture 一致 |
| **evidence_head_sha** | `d2cf1a1841dfbdcdb14d15698297b701a7acdcda` | 本 eng PR 证据包 HEAD（capture 后同提交） |
| **capture_helper_commit_sha** | `d2cf1a1841dfbdcdb14d15698297b701a7acdcda` | `capture-hero-host-slice6-evidence.mjs` + probe 库 |

## 范围（1021–1024）

| 项 | 结果 | 备注 |
|---|---|---|
| 4 template / 8 manifest ID / 16 PNG | PASS | `hero.avatar.{1021..1024}.v1` + bust |
| manifest 仅增量 +8 | PASS | 保留 main 既有 75 项 |
| PNG SHA256 对齐 #1203 正文 | PASS | 16/16 |
| 未合并 #1203 / #1204–#1207 / #1191–#1193 / #1201 / #1195 / #1198 / #1069 / #1017 / #108 / #983 / #697 / #77 / #82 | PASS | 仅路径复制 |
| 生产主城 → 将领面板（`hero-panel-roster`） | PASS | |
| 1600 DPR1/DPR2 目标列表圆头像+主行名在 clip 内 | PASS | `listAvatarFrameOk` @ probe-log |
| 1280 sameframe bust+name | PASS | |
| DPR2 走 2× 纹理 | PASS | probe @ dpr2 |
| 面部静态 ≥60% | PASS | |

## 每将领产物

| template_cfg_id | 名称 | 证据目录 |
|---|---|---|
| 1021 | 鲁肃 | `docs/art/samples/hero-host-slice6/runtime/1021/` |
| 1022 | 黄盖 | `docs/art/samples/hero-host-slice6/runtime/1022/` |
| 1023 | 魏延 | `docs/art/samples/hero-host-slice6/runtime/1023/` |
| 1024 | 姜维 | `docs/art/samples/hero-host-slice6/runtime/1024/` |

## 重跑捕获

```bash
cd client && node scripts/capture-hero-host-slice6-evidence.mjs
# 仅重拍 1600：
# SKIP_SAMEFRAME=1 SKIP_1280_VIEWPORT=1 node scripts/capture-hero-host-slice6-evidence.mjs
```
