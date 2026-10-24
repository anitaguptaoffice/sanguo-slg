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

## 5. 俘虏招降 / 释放（Captive）

| 项 | Legacy（#82 `HeroFunc.php`） | M1 实现 |
|---|---|---|
| 状态 | `sys_city_hero.state=5` 俘虏 | `player_hero.status=6`（`StatusCaptive`；对齐 legacy state=5 语义，与城主 `status=5` 分轨） |
| 元数据 | `sys_hero_captive` + `mem_hero_summon` 道具需求 | `player_hero_captive`（城 `city_id` + 招降道具闸） |
| 列表 | 城池将领面板 | `hero.v1.ListCaptiveHeroes` |
| 预检 / 确认 | `trySummonHero` / `sureSummonHero` | `TrySummonCaptive` / `SureSummonCaptive` |
| 黄金 | `getHeroSummonGold`（三维溢出 ×50 后 ×50） | `HeroSummonGold` = `HeroSalary`×50；扣 `player_wallet.gold`（与客栈口径一致） |
| 高等级道具 | `makeHeroSummonNeed` 随机珠宝 gid 30–38 | **M1 delta**：等级 ≥50 固定 `item_cfg_id=2050`，数量 `1+(level-50)/10` |
| 爵位 | `nobility` 门槛 | **M1 delta**：暂不校验爵位 |
| 名将概率 / 结交 | `sys_lionize` 成功率 | 俘虏线仍按普通招降；名将结交见 §6 |
| 释放 | `releaseHero` → 野地 + 删 captive | `ReleaseCaptive` 删除 `player_hero` 与 captive 行 |
| 容量 | `cityHasHeroPosition` | 招降成功时复用 `HasHeroCapacity`（俘虏不计入 `CountOwnedHeroes`） |
| 产俘 | 战报抓将 | **M1**：`InjectCaptive` 测试/GM 注入；真实战报产俘另开 MIL 卡 |

## 6. 来投接受 / 拒绝（Coming）

| 项 | Legacy（#82 `HeroFunc.php`） | M1 实现 |
|---|---|---|
| 状态 | `sys_city_hero.state=6` 来投待接受 | `player_hero.status=7`（`StatusComing`；对齐 legacy state=6 语义） |
| 元数据 | 来投队列挂城池 | `player_hero_coming`（城 `city_id`） |
| 列表 | 城池将领面板 | `hero.v1.ListComingHeroes` |
| 预检 / 确认 | `tryAcceptHero` / `sureAcceptHero` | `TryAcceptComing` / `SureAcceptComing` |
| 拒绝 | `rejectHero` 删将 | `RejectComing` 删除 `player_hero` 与 coming 行 |
| 费用 | 无黄金/道具（赠送入队） | **M1**：接受不扣资源 |
| 容量 | `cityHasHeroPosition` | `HasHeroCapacity` + `CountOwnedHeroes`（来投待接受不计入容量） |
| 来源 | 玩家赠送 / 俘虏转让等 | **M1**：`InjectComing` 测试/GM；真实产出来投另开卡 |

## 7. 名将结交 / 游说（Persuade / Lionize）

| 项 | Legacy（#82 `HotelFunc.php`） | M1 实现 |
|---|---|---|
| 进度表 | `sys_lionize`（uid,npcid,friend,state） | `player_hero_lionize` |
| 目标将 | `cfg_npc_hero` 全表 | **M1 delta**：`DefaultPersuadeTargets` 子集（模板 1001–1004） |
| 结交 | `LionizeHero` 扣金 `level×500`，friend=10，state=1 | `LionizeHero` 首次调用（state=0）同口径扣 `player_wallet.gold` |
| 游说 | `PersuadeHero` friend≥100、每日一次、锦囊×15、概率夺将 | **M1 delta**：`PersuadeHero` 每次 +10 friend（上限 30）、24h 冷却、道具 `item_cfg_id=2004`×1；无概率夺 NPC 城将 |
| 招入 | 游说成功 state=2 | **M1 delta**：friend≥30 时 `LionizeHero` 再次调用写入 `player_hero`（模板将） |
| 容量 | `cityHasHeroPosition` | `HasHeroCapacity` + `CountOwnedHeroes`（同客栈/俘虏） |
| 爵位 / 同时结交上限 | 爵位≥2；state=1 最多 2 人（道具可扩） | **M1 delta**：暂不校验 |

## 验证

- `internal/military/march/legacy_align_test.go`：legacy 欧氏 + 6000 对拍常量  
- `internal/military/battle/legacy_pk_test.go`：PKDamage 样本  
- `internal/domestic/production_align_test.go`：`domestic.md` 一小时产出  
- `internal/hero/hotel_test.go`：客栈招募与招贤馆容量拒绝  
- `internal/hero/captive_test.go`：俘虏招降/释放与容量、道具闸  
- `internal/hero/coming_test.go`：来投接受/拒绝与容量、非 coming 拒绝  
- `internal/hero/persuade_test.go`：结交好感、达标招入、容量/冷却/好感不足拒绝  
