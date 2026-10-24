# ART-UI-FILTER-008 运行时工程验收（非美术静态 PASS）

| 项 | 值 |
|---|---|
| tip SHA | `8c45fa1ac3429cec3811211d34cc3c7a7d158f50` |
| 范围 | 邮件 + 日常筛选面板（wave:27 CLIENT-121～127 + #509 mount） |
| 采集 | Playwright Chromium + mock 网关 + vite dev |
| 再生 | `cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs` |

## 结论（工程探针 + JPEG）

| 检查项 | 结果 |
|---|---|
| 筛选 chip DOM ≥44×44（`getBoundingClientRect` / CSS min 回退，对齐 `probeFilterChipHitMeetsMin`） | **PASS** |
| count>0 角标节点可见 | **PASS** |
| count=0 整块角标节点 `hidden` + `.hidden`（非仅空文案） | **PASS** |
| 综合（本包工程终验证据，仍非美术签字） | **PASS** |

## 视口 JPEG

| 文件 | 视口 | 面板 |
|---|---|---|
| `runtime/mail-filters-1600x900-dpr1.jpg` | 1600x900-dpr1 | mail |
| `runtime/mail-filters-1600x900-dpr2.jpg` | 1600x900-dpr2 | mail |
| `runtime/mail-filters-1280x720.jpg` | 1280x720 | mail |
| `runtime/daily-filters-1600x900-dpr1.jpg` | 1600x900-dpr1 | daily |
| `runtime/daily-filters-1600x900-dpr2.jpg` | 1600x900-dpr2 | daily |
| `runtime/daily-filters-1280x720.jpg` | 1280x720 | daily |
| `runtime/mail-filters-badge-zero-1600x900-dpr1.jpg` | 1600×900 DPR1 | mail（空收件箱，角标归零） |

## Chip 探针明细（px）

| 面板 | 视口 | chip | width | height | ≥44 |
|---|---|---|---:|---:|---|
| mail | 1600x900-dpr1 | mail-filter-all | 74.0 | 44.0 | Y |
| mail | 1600x900-dpr1 | mail-filter-unread | 74.0 | 44.0 | Y |
| mail | 1600x900-dpr2 | mail-filter-all | 74.0 | 44.0 | Y |
| mail | 1600x900-dpr2 | mail-filter-unread | 74.0 | 44.0 | Y |
| mail | 1280x720 | mail-filter-all | 107.0 | 44.0 | Y |
| mail | 1280x720 | mail-filter-unread | 107.0 | 44.0 | Y |
| daily | 1600x900-dpr1 | daily-filter | 44.0 | 44.0 | Y |
| daily | 1600x900-dpr1 | daily-filter | 56.0 | 44.0 | Y |
| daily | 1600x900-dpr1 | daily-filter | 80.0 | 44.0 | Y |
| daily | 1600x900-dpr1 | daily-filter | 56.0 | 44.0 | Y |
| daily | 1600x900-dpr2 | daily-filter | 44.0 | 44.0 | Y |
| daily | 1600x900-dpr2 | daily-filter | 56.0 | 44.0 | Y |
| daily | 1600x900-dpr2 | daily-filter | 80.0 | 44.0 | Y |
| daily | 1600x900-dpr2 | daily-filter | 56.0 | 44.0 | Y |
| daily | 1280x720 | daily-filter | 44.0 | 44.0 | Y |
| daily | 1280x720 | daily-filter | 56.0 | 44.0 | Y |
| daily | 1280x720 | daily-filter | 80.0 | 44.0 | Y |
| daily | 1280x720 | daily-filter | 56.0 | 44.0 | Y |

## 角标探针

| 面板 | 视口 | role | count | 归零隐藏 OK |
|---|---|---|---:|---|
| mail | 1600x900-dpr1 | mail-filter-all-count | 1 | Y |
| mail | 1600x900-dpr1 | mail-filter-unread-count | 2 | Y |
| mail | 1600x900-dpr1 | — | 1 | Y |
| mail | 1600x900-dpr2 | mail-filter-all-count | 1 | Y |
| mail | 1600x900-dpr2 | mail-filter-unread-count | 2 | Y |
| mail | 1600x900-dpr2 | — | 1 | Y |
| mail | 1280x720 | mail-filter-all-count | 1 | Y |
| mail | 1280x720 | mail-filter-unread-count | 2 | Y |
| mail | 1280x720 | — | 1 | Y |
| daily | 1600x900-dpr1 | daily-claimable-count-badge | 1 | Y |
| daily | 1600x900-dpr2 | daily-claimable-count-badge | 1 | Y |
| daily | 1280x720 | daily-claimable-count-badge | 1 | Y |

详细 JSON：`probe-log.json`。

> **说明**：`docs/art/samples/art-ui-filter-008/hit-proof.json` 为静态挂载契约；本目录为 tip 上 **运行时** 接线证据，供 PR #108 工程终验引用。Draft #506 / art hold #108 **未合并**；本结论 **不是** 美术静态 PASS。
