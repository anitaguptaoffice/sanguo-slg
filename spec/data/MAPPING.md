# SPEC-004 / DATA-001 / DATA-002 字段映射

| 命令 | 作用 |
|------|------|
| `python3 tools/data/generate_seeds.py` | 生成 `spec/data/generated/*` |
| `python3 tools/data/generate_seeds.py --check` | 校验生成物与源一致 |
| `python3 tools/data/test_generate_seeds.py` | 幂等、check、CORE_SUBSET 上限 |

行数上限见 [CORE_SUBSET.md](./CORE_SUBSET.md)；生成器在超限时失败退出。

## DATA-002（第二批扩量）

| 项 | 说明 |
|----|------|
| 触发 | INTG-005 + CLIENT-006 冒烟通过后，编排者开 DATA-002；上限见 CORE_SUBSET「DATA-002 默认」表 |
| 源数据 | `tools/data/render_data002_sources.py` 可重跑以渲染 `spec/data/source/{items,heroes,quests,shop}.yml`（文案手编，非 legacy 拷贝） |
| 稳定 id | `items.yml` 前 6 项顺序不变（`item_cfg_id` 2001–2006）；`quests.yml` 首条仍为 `tutorial_build_hall`（`quest_cfg_id` 1001） |
| 校验 | `SUBSET_LIMITS` 与 CORE_SUBSET 一致；`validate_core_subset` 统计 quests / objectives / items / heroes / shops / offers / reward_rows |
| 展示字段 | 任务 `title`、`summary` → `rewards.display`；道具 `meta.description`；将领 `base_stats.tagline`；商城 `shops[].name` 与 `shelves[].name` |

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
| `base_stats.tagline` | 将领简介（JSON 内，非独立列） |
| `base_stats.historical_identity` | 美术绘制用的史实人物名（与 `name` 对齐；见 `docs/art/hero-template-historical-identity.md`） |

→ `cfg_hero_template.sql`

## cfg_item（`spec/data/source/items.yml`）

| `item_type` | 含义 |
|-------------|------|
| 1 | 资源包 `meta.grants` / 宝箱 `meta.box_contents` |
| 2 | 加速 |
| 3 | 招募 |
| 4 | 训练兵力 |

| 源字段 | 说明 |
|--------|------|
| `meta.description` | 玩家可见描述（文案重写） |
| `meta.reward_pack_id` | 奖励包 id（计入子集奖励行） |
| `meta.box_contents[]` | 宝箱权重明细（计入子集奖励行） |

`item_cfg_id` 从 2001 起按文件顺序。

→ `cfg_item.sql`

## cfg_quest（`spec/data/source/quests.yml`）

| 源字段 | 目标列 |
|--------|--------|
| `quests[]` 顺序 + 1001 起 | `quest_cfg_id` |
| `code`, `quest_type` | 同名列 |
| `chain_id`, `sort_in_chain`, `unlock_level`, `repeatable` | M4 列（`m4_001_quest.sql`） |
| `prev_quest_code` | 解析为 `prev_quest_cfg_id` |
| `objectives[]` | `objectives` JSONB |
| `title`, `summary` + `rewards` | 合并入 `rewards` JSON（`display.title` / `display.summary`） |
| `rewards.items[].item_code` | 生成时解析为 `item_cfg_id` |

`quest_type`：1 主线/教程链，2 日常（可 `repeatable: true`），3 支线。

→ `cfg_quest.sql`

## cfg_shop / shelf / offer（`spec/data/source/shop.yml`）

| 源 | 目标 |
|----|------|
| `shops[]` 顺序 + 1 起 | `cfg_shop.shop_cfg_id` |
| `shops[].shelves[]` 全局递增 | `cfg_shop_shelf.shelf_cfg_id` |
| `offers[]` 全局递增 + 1001 起 | `cfg_shop_offer.offer_cfg_id` |
| `offer.item_code` | `item_cfg_id`（对齐 `items.yml` 顺序） |
| `offer.price` | `price` JSONB（`resources` / `items`） |
| `per_player_*_limit`, `server_stock_limit` | 可购限制列；未填为 NULL |

→ `cfg_shop.sql`、`cfg_shop_shelf.sql`、`cfg_shop_offer.sql`

## 建筑 JSON（`buildings.yml` + `params.yml → domestic`）

合并 `buildings.yml` 的 ID/名称与 `domestic.build` / `production` / `main_hall`。无 `cfg_building` DDL 时以 JSON 发布；`city_building.building_cfg_id` 引用此处 ID。

→ `cfg_building.json`

## catalog.json（`items.yml` → 运行时背包目录）

与 `cfg_item` 同源；生成器同步写入：

- `spec/data/generated/catalog.json`
- `internal/content/seed/catalog.json`（`go:embed`，供 CONTENT 域加载）

调参：改 `params.yml` 或 `source/*.yml` 后重跑生成器。

## Wave 7 规则对齐（`source/params/`）

| 文件 | 用途 |
|------|------|
| `params/march.yml` | 行军 legacy `GRID_DISTANCE` 与 M1 Chebyshev 校准 |
| `params/combat_reference.yml` | PK 线伤害样本（M1 池化战斗不改） |
| `params/domestic_production.yml` | 产出公式对照 `domestic.md` |

详见 `spec/rules/legacy_alignment.md`。
