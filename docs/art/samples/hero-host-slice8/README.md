# HERO-HOST Slice8 — 夏侯惇 / 夏侯渊 / 张郃 / 徐晃工程挂载（1029–1032）

工程分支自 [Draft #1205](https://github.com/anitaguptaoffice/sanguo-slg/pull/1205) @ `181b0191b834b2e0c3a983a7911690552fe143f0` 路径复制 **16 PNG** + `manifest.json` **增量追加** 8 条 `slice:8` 条目，**不合并**美术 Draft。

生产宿主布局与探针严格度继承 Slice7 工程挂载 [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) @ `035abdda48bdfab8bac44837c72afea76e9eae68`；Slice7 已在 #108 签收路径，本卡仅挂载 1029–1032。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿混用）

| 角色 | 字段 | 说明 |
|---|---|---|
| 美术源 | `art_head_sha` | [#1205](https://github.com/anitaguptaoffice/sanguo-slg/pull/1205) @ `181b0191…` |
| 宿主基线 | `base_host_sha` | [#1233](https://github.com/anitaguptaoffice/sanguo-slg/pull/1233) @ `035abdda…`（布局/CSS/HeroMailPanels；**无** Slice8 capture/mock/资产） |
| 证据提交 | `evidence_head_sha` / `tip_sha` / `runtime_code_sha` | 签收固定提交 `28c1d9ac…`（含 capture8 + mock + runtime JPEG）；见各 `probe-log.json` |
| 原采证脚本 blob | `capture_script_blob_sha` | `@ evidence_head` 的 `capture-hero-host-slice8-evidence.mjs`（`0dbec076…`） |
| 元数据修订脚本 blob | `capture_script_blob_sha_at_pr_head` | PR `HEAD` 上仅改 probe 写入逻辑的脚本；**非**重拍采证（见各 `probe-log.json`） |
| mock blob | `mock_blob_sha` | `@ evidence_head` 的 `server.mjs`（`5da72c80…`） |

明细见 `CHECKLIST.md` 与各 `runtime/{1029..1032}/probe-log.json`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=181b0191b834b2e0c3a983a7911690552fe143f0 \
  node scripts/capture-hero-host-slice8-evidence.mjs
```

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1029 node scripts/capture-hero-host-slice8-evidence.mjs
```
