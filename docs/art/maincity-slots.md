# 主城槽位显示约定（DRAFT）

## 协议与键名（不可变）

- 升级/建造协议字段：`slot_key`（`spec/proto`、`domestic.v1`）。
- 客户端展示用键名保持与现网一致：**`hall`, `farm`, `lumber`, `quarry`, `iron`, `barracks`, `wall`**。
- **禁止**在本轮修改升级协议或重命名 `slot_key`（配置表 `code` 如 `main_hall` 仅数据层命名，对外 RPC 仍用 `hall`）。

## 坐标系

- 原点：舞台左上角，与 [layout-landscape.md](./layout-landscape.md) 中 **MAIN-CITY STAGE** 一致（设计基线 1600×900，舞台 y ∈ [56, 844)）。
- 表中 `display` / `hit` 均为 **逻辑 px**（设计基线）。
- `ground_anchor`：相对 **display 矩形左上角** 的脚底落点（用于排序与 y-sort）。

## 占位尺寸声明

当前 `MainCityScene` 用 **100×72** 色块横排绘制建筑，**不是**美术目标尺寸，仅开发占位。

## 槽位表（建议首版布局）

| slot_key | 显示名 | display (x,y,w,h) | ground_anchor (gx,gy) | z | hit (x,y,w,h) | 备注 |
|---|---|---|---:|---:|---|---|
| hall | 官府 | 640, 120, 320, 240 | 160, 240 | 30 | 630, 110, 340, 260 | 视觉中心偏后 |
| farm | 农田 | 180, 380, 200, 160 | 100, 160 | 20 | 170, 370, 220, 180 | 左下产区 |
| lumber | 伐木场 | 380, 320, 200, 160 | 100, 160 | 22 | 370, 310, 220, 180 | |
| quarry | 采石场 | 1020, 320, 200, 160 | 100, 160 | 22 | 1010, 310, 220, 180 | |
| iron | 铁矿 | 1220, 380, 200, 160 | 100, 160 | 20 | 1210, 370, 220, 180 | 右下产区 |
| barracks | 兵营 | 260, 520, 220, 180 | 110, 180 | 25 | 250, 510, 240, 200 | |
| wall | 城墙 | 480, 200, 640, 120 | 320, 120 | 10 | 480, 200, 640, 140 | 底层环绕；可拆为多段 sprite |

绘制顺序：按 **z 升序** 绘制，`wall` 最先，`hall` 最后（靠前）。

点击检测：优先 **z 高** 的建筑；`hit` 可略大于 `display` 便于触控，但横屏 PC 以鼠标为准。

## 稳定 asset_id（与样本卡对齐）

| slot_key | 建议 asset_id |
|---|---|
| hall | `mc.building.hall.v1` |
| farm | `mc.building.farm.v1` |
| lumber | `mc.building.lumber.v1` |
| quarry | `mc.building.quarry.v1` |
| iron | `mc.building.iron.v1` |
| barracks | `mc.building.barracks.v1` |
| wall | `mc.building.wall.v1` |
| （背景） | `mc.bg.plateau.v1` |

## 世界地图瓦片（独立单位 — 禁止与主城混用）

| 项 | 状态 |
|---|---|
| 世界格网逻辑 | 500×500（`WORLD-001`） |
| **每格显示像素（1×）** | **TBD**；假设 **64×64** 或 **48×48** 等距格，待世界场景 PR 冻结 |
| 主城 `display` 逻辑 px | 仅用于 1600×900 舞台，**不得**用主城建筑 export 尺寸推算世界格 |
| 世界地表 asset_id 前缀 | 规划为 `wm.tile.*` / `wm.deco.*`，与 `mc.*` 分离 |

混用会导致缩放与批图集策略冲突；实现时 manifest 分 `pack: "maincity" | "world"`（schema 已预留）。
