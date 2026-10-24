# Legacy 规则抽样对齐（wave 7）

只读参照：`origin/reference/legacy-source` → `reference/legacy/server/game/`（**禁止**合并 #82、**禁止**粘贴 PHP 源码）。  
可调参真源：`spec/data/source/params/*.yml` 与 `spec/rules/params.yml`。  
与核心子集冲突时，优先级见 [CORE_SUBSET.md](../data/CORE_SUBSET.md)。

## 1. 行军时间

| 项 | Legacy | M1 实现 |
|---|---|---|
| 出处 | `GroundFunc::StartTroop` | `internal/military/march/duration.go` |
| 距离 | 欧氏 `sqrt(dx²+dy²)` | Chebyshev `max(|dx|,|dy|)` |
| 时间 | `pathLength * GRID_DISTANCE / minSpeed` | `distance * sec_per_cell_at_speed_50 * 50 / speed` |
| 常量 | `GRID_DISTANCE=6000`（`common.php`） | `sec_per_cell_at_speed_50=72`（`params/march.yml`） |

**决策**：M2 行军已按格子 Chebyshev 与瓶颈速度上线；wave7 不把欧氏距离与驿站/科技加成并入公式，仅在 `params/march.yml` 保留 legacy 系数供对拍测试（`LegacyMarchDurationSec`）。

## 2. 战斗伤害（抽样）

| 项 | Legacy | M1 实现 |
|---|---|---|
| 出处 | `PKFunc::PKDamage` | `spec/rules/combat.md` 池化回合 |
| 公式 | `attack * (1 - def/(def+2000))` | 兵种占比 × 攻防池 × 克制 × 随机 |

**决策**：战场副本与 PK 线使用单点攻防；本项目 MIL-001 已固定池化战报。对齐动作：在单测中固定 `combat_reference.yml` 的 PK 样本公式，战斗引擎 **不** 改为 PKDamage。

## 3. 资源产出

| 项 | Legacy | M1 实现 |
|---|---|---|
| 出处 | `CityFunc::getCityProduct` | `internal/domestic/service.go` `settleProduction` |
| 逻辑 | 建筑劳力 × 全局速率 × 科技 + 将领内政 | `base_per_hour * level * main_hall_bonus` |

**决策**：M4 仍用 `domestic.md` 简化式；建筑升级耗时/消耗参照 `BuildingFunc::doGetSimpleBuildingInfo` 读 `cfg_building_level`，实现侧用 `params.yml` 的 `cost_growth` / `time_growth` 指数曲线（见 domestic 单测）。

## 4. 客栈招将池（Hero / Hotel）

| 项 | Legacy（#82 `HotelFunc.php`） | M1 实现 |
|---|---|---|
| 客栈建筑 | `ID_BUILDING_HOTEL`（bid=10）决定池容量与刷将等级上限 | `building_cfg_id=8`（`hotel` 槽位，读 `city_building`） |
| 招贤馆容量 | `cityHasHeroPosition`：`ID_BUILDING_OFFICE`（bid=11）等级 **>** 该城 `sys_city_hero` 条数 | `building_cfg_id=1`（官府/主殿）等级 **>** 玩家 `player_hero` 总数（M1 无城池驻将字段，容量按玩家全局计） |
| 候选表 | `sys_recruit_hero` 随机名/脸/三维比值 | `city_hotel_recruit`；事务/智力/武力映射 `politics`/`intel`/`force` |
| 刷池 | `doGetRecruitHero` 时间块淘汰 + 补至客栈等级；`resetRecruitHero` 消耗招贤令（gid=141） | `ListHotelRecruitCandidates` 懒刷新时间块；`RefreshHotelRecruitPool` 消耗 **访贤简帖** `item_cfg_id=2004`（M1 代招贤令）全量重刷 |
| 招募 | `recruitHero` 扣城池 `gold` → `sys_city_hero` | `RecruitHotelCandidate` 扣 `player_wallet.gold` → `player_hero`（`template_cfg_id=0` + `display_name`） |
| 并行通道 | 活动/模板将 | 保留 `hero.v1.RecruitHero` 模板+卷轴路径，与客栈池互不替代 |

**决策**：跟原版 **客栈池** 而非「仅模板抽卡+容量」；美术 roster 1009+ 冻结与本服逻辑分轨。活动将 `generateHeroFromConfig`、结交/游说、野兵 rumor **不在** HERO-hotel-001。

## 验证

- `internal/military/march/legacy_align_test.go`：legacy 欧氏 + 6000 对拍常量  
- `internal/military/battle/legacy_pk_test.go`：PKDamage 样本  
- `internal/domestic/production_align_test.go`：`domestic.md` 一小时产出  
- `internal/hero/hotel_test.go`：客栈招募与招贤馆容量拒绝  
