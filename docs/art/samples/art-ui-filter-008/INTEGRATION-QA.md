# ART-UI-FILTER-008 运行时工程验收（CLIENT-137 补证）

| 项 | 值 |
|---|---|
| tip SHA | `75c0f953bf3cddde78ad29474896ed6b0804c4d1` |
| 范围 | 邮件 + 日常；全视口 JPEG（非面板 crop） |
| 采集 | Playwright Chromium + mock 网关 + vite dev |
| 再生 | `cd client && node scripts/capture-art-ui-filter-008-runtime-evidence.mjs` |

## 结论（探针 + 目视 JPEG；非美术静态 PASS）

| 检查项 | 结果 |
|---|---|
| chip DOM ≥44×44（仅进展指标，不单独等同完整命中 PASS） | **PASS** |
| 72×32 精灵 + 容器/视口可见交集 | **PASS** |
| 相邻 chip 命中盒无重叠 | **PASS** |
| elementFromPoint 中心落点命中 chip | **PASS** |
| 边缘 elementFromPoint 命中 chip 热区 | **PASS** |
| 边缘点击落点命中 chip（Playwright） | **PASS** |
| 纸底 chip 标签色 #3d2e1f | **PASS** |
| 九宫行条逻辑高 **40px**（仅横向拉伸） | **PASS** |
| chip 四态 staging（含 pressed/selected 真图） | **PASS** |
| row 三态 staging（40px 行条完整） | **PASS** |
| count **9** 角标（不重拍 count=0） | **PASS** |
| count **9+** 角标（10→9+） | **PASS** |
| 日常行条主标题在 40px skin bar 内且横向铺满 | **PASS** |
| 邮件 chip 实例 badge_count 皮肤可见交集 | **PASS** |
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
| `runtime/mail-badge-count-exact-nine-1600x900.jpg` | 1600×900 | mail count 9 |
| `runtime/mail-chip-badge-count-skin-nine-crop-1600x900.jpg` | crop | mail chip badge_count 皮肤 count=9 |
| `runtime/mail-chip-badge-count-skin-nineplus-crop-1600x900.jpg` | crop | mail chip badge_count 皮肤 9+ |

详细 JSON：`probe-log.json`。

> **说明**：008 仍为「联调修正/补证中」，待美术在 #108 目视复签；Draft #506 / art hold **未合并**。
