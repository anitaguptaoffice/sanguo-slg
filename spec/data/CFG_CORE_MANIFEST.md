# M4 可玩必有 `cfg_*` 清单（对照 legacy TABLES.md）

来源：只读分支 `reference/legacy-source` → `reference/legacy/db/TABLES.md` 与 `schema.sql` 字段。  
**禁止**合并 PR #77 / #82；**禁止**把 legacy SQL/PHP 提交进本仓库。

下表列出 wave 7 核心子集需要覆盖的 legacy 配置表，以及在新项目中的落点（`spec/data` 源文件或 `spec/db` 表）。全量 legacy 约 143 张 `cfg_*` 表，此处仅 **M4 任务 + 背包 + 商城 + 将 + 战/内政基础** 所需子集。

## 任务链

| Legacy 表 | 约行数 (全量) | 新 schema / 管线 | 子集上限 (见 CORE_SUBSET.md) |
|---|---:|---|---|
| `cfg_task` | 10235 | `cfg_quest`（`m4_001_quest.sql`）+ `spec/data/source/quests.yml` | ≤80 |
| `cfg_task_goal` | 12435 | 并入 `cfg_quest.objectives` JSON | ≤120 goal 行 |
| `cfg_task_group` | 2562 | `cfg_quest.chain_id` / `sort_in_chain` | 随任务数 |
| `cfg_task_reward` | 16927 | `cfg_quest.rewards` + `CONTENT-002` 发奖 | 奖励行 ≤60 |
| `cfg_task_schedule` | 87 | `cfg_quest.meta` 或省略（M4 不做日程活动） | 0（wave7） |

## 道具与背包

| Legacy 表 | 约行数 | 新 schema / 管线 | 子集上限 |
|---|---:|---|---|
| `cfg_goods` | 11414 | `cfg_item`（`006_content.sql`）+ `items.yml` | ≤120 |
| `cfg_pack_goods` | 223 | `cfg_item.meta` 礼包组合 | 随道具 |
| `cfg_box_details` | 14170 | `items.yml` 宝箱 `meta` + 发奖 | 明细 ≤60 |
| `cfg_box_open_condition` | 17 | `items.yml` `meta.unlock` | 抽样 |

## 将领

| Legacy 表 | 约行数 | 新 schema / 管线 | 子集上限 |
|---|---:|---|---|
| `cfg_npc_hero` | 927 | `cfg_hero_template` + `heroes.yml` | 合计模板 ≤60 |
| `cfg_recruit_hero` | 167 | 招募池引用 `template_cfg_id` | 含上项 |
| `cfg_hero_level` | 125 | `spec/rules` / 成长系数（非 cfg 行灌入） | 公式对齐 RULES-ALIGN |
| `cfg_hero` | 15 | 常量/枚举，可进 `heroes.yml` meta | 全量可纳入 |

## 商城

| Legacy 表 | 约行数 | 新 schema / 管线 | 子集上限 |
|---|---:|---|---|
| `cfg_shop` | 1129 | `cfg_shop`（`m4_002_shop.sql`）+ `shop.yml` | ≤12 入口 |
| `cfg_shop_add` | 1028 | `cfg_shop_offer` | ≤80 可购行 |
| `cfg_shop_arm` | 88 | 并入 offer `meta` 或 wave7 省略 | 0–10 |
| `cfg_goods_copper` | 54 | 价格走 `offer.price` JSON | 抽样 |

## 战斗与兵种（M2 已有，子集保持小表）

| Legacy 表 | 约行数 | 新 schema / 管线 | 子集说明 |
|---|---:|---|---|
| `cfg_soldier` | （见 schema） | `cfg_unit` + `params.yml` | M1 四兵种 + 扩展槽位 |
| `cfg_battle_troop` | 594 | 不导入；战斗用 `internal/military/battle` | wave7 不对齐战场 troop cfg |

## 建筑与内政

| Legacy 表 | 约行数 | 新 schema / 管线 | 子集说明 |
|---|---:|---|---|
| `cfg_building` | 20 | `buildings.yml` + `cfg_building.json` | M1 七种建筑可对齐全表 |
| `cfg_building_level` | 320 | `params.yml → domestic.build` | 等级曲线抽样，非 320 行灌入 |
| `cfg_building_condition` | 521 | `spec/rules/domestic.md` 前置 + 实现校验 | 规则文档化，非全表 seed |

## 查表路径（实现 agent）

1. `TABLES.md` 确认表名与规模  
2. `schema.sql` 看字段  
3. `server/game/` 搜表名定位规则（只读）  
4. 在本仓库写 `spec/data/source/*.yml` 或更新 MAPPING.md  

## 已映射的既有 seed（SPEC-004）

| 新产物 | 源 |
|---|---|
| `cfg_unit.sql` | `params.yml → combat.troops` |
| `cfg_hero_template.sql` | `heroes.yml` |
| `cfg_item.sql` | `items.yml` |
| `cfg_building.json` | `buildings.yml` + `domestic` params |

DATA-001 在以上基础上扩展 **任务/商城** 行，且不突破 [CORE_SUBSET.md](./CORE_SUBSET.md)。
