# Wave 7/9 核心配置子集（DATA-002 第二批上限）

对照 `origin/reference/legacy-source` 中 `reference/legacy/db/TABLES.md`（只读，见 [docs/reference.md](../../docs/reference.md)）划定 **M4 可玩闭环** 所需静态配置的上限。DATA-001 首批灌数与 INTG-005 冒烟不得超出当时行数；**DATA-002** 在 INTG-005 + CLIENT-006 通过后由编排者授权约 **+50%** 上限扩量（本表为第二批硬顶）。

### DATA-002 扩量理由（wave:9）

INTG-005 已在首批子集下跑通「任务→背包→商城扣费→GM 发奖」；HERO-002 / INTG-006 需要更长的主线链、更多将领模板与商城货架做招募与回归冒烟。在仍不纳入活动/战场/成就全量表的前提下，将各表硬顶上调约 50%，供本 PR 手编抽样填充（行数 ≤ 下表，非一次填满）。

## 行数上限（DATA-002 默认）

| Legacy `cfg_*` / 概念 | 新管线位置 | 默认上限 | 说明 |
|---|---|---:|---|
| `cfg_task` | `spec/data/source/quests.yml` → `cfg_quest` | **120** | 含主线/日常/支线抽样，不含活动任务表 |
| `cfg_task_goal` | `quests.yml` 内 `objectives` / 附属 goal 行 | **180** | 与任务 id 绑定，不单独建表 |
| `cfg_goods`（道具定义） | `spec/data/source/items.yml` → `cfg_item` | **180** | 与下项合并计数：道具种类总量 ≤180 |
| `cfg_item`（若与 goods 分列） | 同上 `cfg_item` | （含上项） | 新 schema 仅 `cfg_item` |
| 将领模板（`cfg_npc_hero` + `cfg_recruit_hero` 抽样） | `spec/data/source/heroes.yml` → `cfg_hero_template` | **90** | 模板行，不含玩家实例 |
| `cfg_shop`（商城入口） | `spec/data/source/shop.yml` → `cfg_shop` | **18** | 商城类型/入口数 |
| 可购条目（`cfg_shop` 内 offer 或 legacy `cfg_shop_add` 行） | `shop.yml` → `cfg_shop_offer` | **120** | 货架上可购买行 |
| 奖励包/宝箱明细（`cfg_task_reward` + `cfg_box_details` 抽样） | `quests.yml` / `items.yml` 的 `rewards`、`meta` | **90** | 独立奖励行（非道具本体） |

上限可在 PR 中调整，但 **必须在同一 PR 修改本表并写明理由**。

生成器常量见 `tools/data/generate_seeds.py` 中 `SUBSET_LIMITS`（须与本表一致）。

## Wave 7/9 不纳入的 `cfg_*` 前缀/表

以下保持 **零行** 进入 `spec/data` 核心子集；需要时由编排者另开扩量卡：

| 类别 | 代表表（legacy） | 原因 |
|---|---|---|
| 活动 | `cfg_act*`、`cfg_act_paygift`、`cfg_act_shopgift` | 非 M4 最小闭环 |
| 排行奖励 | `cfg_activity_rank*` | 依赖活动/赛季 |
| 禁名词库 | `cfg_baned_name`、`cfg_baned_mail_content` | 体量大、与玩法数值无关 |
| 战场副本 | `cfg_battle_*`（战场服） | M2 已用简化战斗，不对齐战场副本 cfg |
| 装备养成 | `cfg_armor*`、`cfg_book` 全量 | 超出 M4 背包/任务/商城范围 |
| 随机名库 | `mem_cfg_*name*` | 运行时生成，非 seed |
| 成就全量 | `cfg_achivement*` | 内容向，非本批 |

## 与 SPEC-004 / SPEC-006 的关系

- 建筑/兵种仍走既有 `buildings.yml`、`params.yml → combat.troops`（见 [CFG_CORE_MANIFEST.md](./CFG_CORE_MANIFEST.md)）。
- 任务/商城表结构以 `spec/db/m4_001_quest.sql`、`m4_002_shop.sql` 为准；子集只限制 **行数**，不改 DDL。

## 优先级（与 RULES-ALIGN-001 冲突时）

1. 本文件行数上限  
2. [CFG_CORE_MANIFEST.md](./CFG_CORE_MANIFEST.md) 列出的必有表映射  
3. `spec/rules/*.md` 已实现的 M1/M2 公式  
4. Legacy `server/game` 全量行为（仅作参照）
