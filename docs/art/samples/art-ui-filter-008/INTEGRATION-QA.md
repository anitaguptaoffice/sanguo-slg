# ART-UI-FILTER-008 运行时工程验收（CLIENT-136 补证）

| 项 | 值 |
|---|---|
| tip SHA | `b2e123e76dbd470c5f7a3eaf039554e6e2a5b1c3` |
| 范围 | 邮件 + 日常；全视口 JPEG（非面板 crop） |
| 采集 | Playwright Chromium + mock 网关 + vite dev |
| 再生 | `cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs` |

## 结论（探针 + 目视 JPEG；非美术静态 PASS）

| 检查项 | 结果 |
|---|---|
| chip DOM ≥44×44（仅进展指标，不单独等同完整命中 PASS） | **PASS** |
| 72×32 精灵完全落在按钮可视槽内（可见交集） | **PASS** |
| 相邻 chip 命中盒无重叠 | **PASS** |
| elementFromPoint 中心落点命中 chip | **PASS** |
| 纸底 chip 标签色 #3d2e1f | **PASS** |
| 九宫行高约 ≥40px | **PASS** |
| count 9 / 9+ 角标（跳过 count=0 重拍） | **PASS** |
| 综合工程补证 | **PASS** |

## 全视口 JPEG

| 文件 | 视口 | 面板 |
|---|---|---|
| `runtime/mail-filters-1600x900.jpg` | 1600x900 | mail |
| `runtime/mail-filters-3200x1800.jpg` | 3200x1800 | mail |
| `runtime/mail-filters-1280x720.jpg` | 1280x720 | mail |
| `runtime/daily-filters-1600x900.jpg` | 1600x900 | daily |
| `runtime/daily-filters-3200x1800.jpg` | 3200x1800 | daily |
| `runtime/daily-filters-1280x720.jpg` | 1280x720 | daily |
| `runtime/mail-chips-four-states-1600x900.jpg` | 1600×900 | mail chip 四态 staging |
| `runtime/mail-rows-three-states-1600x900.jpg` | 1600×900 | mail row 三态 staging |
| `runtime/mail-badge-count-nine-1600x900.jpg` | 1600×900 | mail count 9+ |

详细 JSON：`probe-log.json`。

> **说明**：008 仍为「联调修正/补证中」，待美术在 #108 目视复签；Draft #506 / art hold **未合并**。
