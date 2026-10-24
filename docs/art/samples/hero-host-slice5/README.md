# HERO-HOST Slice5 — 许褚 / 荀彧 / 甘宁工程挂载（1019 庞统 HOLD）

工程分支自 [Draft #1193](https://github.com/anitaguptaoffice/sanguo-slg/pull/1193) @ `9f15a34119c1bcb157399693a5420c0a2787a47a` 路径复制 **12 PNG** + `manifest.json` 追加六条 `slice:5` 条目（**不含 1019**），**不合并**美术 Draft。

**1019 庞统**：[#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) shabby 复核高清面部 **59.33% &lt; 60%** → 工程 **HOLD**，见 [HOLD-1019.md](./HOLD-1019.md)。

契约：[hero-avatar-bust-batch.md](../../hero-avatar-bust-batch.md)

## Runtime 证据 SHA（勿与 PR HEAD 混用）

| 角色 | SHA |
|---|---|
| 生产 **runtime_code_sha / tip_sha** | `d7cc3a62f9115572b3fa2fc77725828f563dd2df` |
| **HeroMailPanels.ts** git blob | `3dc43b682fa39b23c38ec183c985a967e51a03d2` |
| **evidence_head_sha**（#1198 证据包） | `15d1b425abb20cab48ebb7ecf779a947151d25d7` |
| **capture_helper_commit_sha** | `15d1b425abb20cab48ebb7ecf779a947151d25d7`（捕获脚本 blob 自 d7cc3a62 后有变） |
| **prior_capture_record_sha** | `e65fefe2e4c83ff68f1fb5371df02e89e21ac990` |

各将领明细见 `runtime/{1017..1020}/probe-log.json` 与 `INVENTORY.md`。

## 捕获（生产主城 mock 链路）

```bash
cd client && npx playwright install chromium
ART_HEAD_SHA=9f15a34119c1bcb157399693a5420c0a2787a47a \
  node scripts/capture-hero-host-slice5-evidence.mjs
```

产物：`runtime/{1017,1018,1020}/*`、`CHECKLIST.md`（不含 1019）。

单将领：

```bash
HERO_TEMPLATE_CFG_ID=1017 node scripts/capture-hero-host-slice5-evidence.mjs
```
