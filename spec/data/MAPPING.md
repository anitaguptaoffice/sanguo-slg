# SPEC-004 字段映射

| 命令 | 作用 |
|------|------|
| `python3 tools/data/generate_seeds.py` | 生成 `spec/data/generated/*` |
| `python3 tools/data/generate_seeds.py --check` | 校验生成物与源一致 |

## cfg_unit（`params.yml → combat.troops`）

| 源 | 列 / `stats` 键 |
|----|----------------|
| `combat.troops.<code>` | `atk`, `def`, `hp`, `speed`, `food_upkeep` |
| `combat.counter` | `stats.counter` |
| `combat.counter_edges` | `stats.counter_edges` |
| 固定顺序 infantry…siege | `unit_cfg_id` 1–4，`code`，`UNIT_NAMES`→`name`，`tier` |

→ `cfg_unit.sql`（`ON CONFLICT` 幂等）

## cfg_hero_template（`spec/data/source/heroes.yml`）

| 源字段 | 目标列 |
|--------|--------|
| `heroes[]` 顺序 + 1001 起 | `template_cfg_id` |
| `code`, `name`, `rarity`, `base_stats` | 同名列 |

→ `cfg_hero_template.sql`

## cfg_item（`spec/data/source/items.yml`）

| `item_type` | 含义 |
|-------------|------|
| 1 | 资源包 `meta.grants` |
| 2 | 加速 |
| 3 | 招募 |
| 4 | 训练兵力 |

`item_cfg_id` 从 2001 起按文件顺序。

→ `cfg_item.sql`

## 建筑 JSON（`buildings.yml` + `params.yml → domestic`）

合并 `buildings.yml` 的 ID/名称与 `domestic.build` / `production` / `main_hall`。无 `cfg_building` DDL 时以 JSON 发布；`city_building.building_cfg_id` 引用此处 ID。

→ `cfg_building.json`

调参：改 `params.yml` 或 `source/*.yml` 后重跑生成器。

## M4 配置源（SPEC-006，手工/后续管线）

| 源文件 | 目标 DDL | 说明 |
|--------|----------|------|
| `source/quests.yml` | `cfg_quest` | `prev_quest_code` 发布时解析为 `prev_quest_cfg_id`；`rewards`/`objectives` 直写 JSONB |
| `source/shop.yml` | `cfg_shop` / `cfg_shop_shelf` / `cfg_shop_offer` | `item_code` 解析为 `item_cfg_id`；`price` 与 `spec/rules/content.md` 一致 |

冒烟与集成测试可据此插入最小种子；生成 SQL 脚本待 CONTENT 管线扩展。
