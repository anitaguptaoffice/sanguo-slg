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
