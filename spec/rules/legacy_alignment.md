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

## 验证

- `internal/military/march/legacy_align_test.go`：legacy 欧氏 + 6000 对拍常量  
- `internal/military/battle/legacy_pk_test.go`：PKDamage 样本  
- `internal/domestic/production_align_test.go`：`domestic.md` 一小时产出  
