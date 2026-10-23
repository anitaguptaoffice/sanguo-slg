# 战斗规则（v1）

战斗服 **纯函数**：输入 `BattleInput`，输出 `BattleReport`（与 SPEC-002 消息对齐由实现方映射字段名）。本文定义数学与流程。

## 1. 兵种与枚举

| 键名 | 中文 | 说明 |
|---|---|---|
| `infantry` | 步兵 | 前排承伤、克制弓兵 |
| `cavalry` | 骑兵 | 高机动、克制步兵 |
| `archer` | 弓兵 | 远程输出、克制骑兵 |
| `siege` | 器械 | 高攻低防，无兵种克制环 |

各兵种基础属性见 `params.yml → combat.troops.<type>`（`atk` 攻击、`def` 防御、`hp` 单兵生命、`speed` 速度）。

【数值】来源：`params.yml → combat.troops.*`  
【调参】改各兵种 `atk/def/hp/speed`；保持四型齐全以便矩阵引用。

## 2. 兵种克制（兵种克制系数）

对 **攻击兵种** `a` 攻击 **被攻击方某兵种** `b` 时，使用乘数 `C(a,b)`：

| 关系 | `C(a,b)` |
|---|---|
| `a` 克制 `b`（见下表有向边） | `counter.advantage` |
| `b` 克制 `a` | `counter.disadvantage` |
| 其余 | `counter.neutral` |

有向克制边（`params.yml → combat.counter_edges`）初版：

- 骑兵 → 步兵  
- 步兵 → 弓兵  
- 弓兵 → 骑兵  
- 涉及 `siege` 的任意组合均为 **中立**

【数值】来源：`params.yml → combat.counter.advantage|disadvantage|neutral` 与 `combat.counter_edges`  
【调参】改 `advantage/disadvantage` 调节克制强度；增删 `counter_edges` 可扩展新克制关系。

## 3. 输入快照

每方军队 `Army`：

```text
troops: map<TroopType, int>   # 各兵种数量，≥0 整数
hero_level: int               # 0 表示无将领；M1 仅用等级线性加成
morale: float                 # 默认 1.0，范围 [0.5, 1.2]（活动/技能后续注入）
```

定义：

- `N = Σ troops[t]`（总兵数）
- 若 `N == 0`，该方 **已溃败**，不参与伤害计算。

## 4. 将领加成（M1 简化）

当 `combat.hero.enabled` 为 true：

```text
hero_atk_mult = 1 + hero_level * atk_per_level
hero_def_mult = 1 + hero_level * def_per_level
```

攻击方用 `hero_atk_mult`，防御方用 `hero_def_mult` 参与下文战力聚合。`hero_level` 上限见 `max_level_m1`。

【数值】来源：`params.yml → combat.hero.*`  
【调参】改 `atk_per_level` / `def_per_level`；关闭战斗将帅影响则设 `enabled: false`。

## 5. 伤害与伤亡（单回合）

对 **攻击方 X** 对 **防御方 Y** 的一个回合（双方各计算一次，见 §6 顺序）：

### 5.1 攻击池与防御池

对 X 的每种兵种 `t`，数量 `n_t > 0`：

```text
w_t = n_t / N_X                                    # 兵种占比
def_mix_b = Σ_s ( w_s_Y * C(t, s) )                # 对 Y 兵种构成的加权克制（Y 的 w 用 Y 自身占比）
atk_line_t = n_t * atk_t * hero_atk_mult_X * morale_X * def_mix_b
```

```text
ATK_POOL_X = Σ_t atk_line_t
```

对 Y 的防御池（用于减伤，不乘克制）：

```text
DEF_POOL_Y = Σ_s ( n_s * def_s * hero_def_mult_Y * morale_Y )
```

### 5.2 回合总伤害（打到 Y 的「生命池」）

```text
ε = 1
R = ROUND_DAMAGE_MULT
U ~ Uniform(damage_random_min, damage_random_max)

RAW = ATK_POOL_X * ATK_POOL_X / (ATK_POOL_X + DEF_POOL_Y + ε) * R * U
DAMAGE_HP = floor(RAW)
```

【数值】来源：`params.yml → combat.round_damage_mult`, `damage_random_*`  
【调参】提高 `round_damage_mult` 加快战斗；收窄随机区间降低波动。

### 5.3 伤亡分配到兵种

Y 的总生命池 `HP_POOL_Y = Σ_s ( n_s * hp_s )`。

若 `DAMAGE_HP >= HP_POOL_Y`：Y 全部兵种置 0，回合结束对该侧。

否则，对每种 `s`：

```text
loss_hp_s = floor(DAMAGE_HP * (n_s * hp_s) / HP_POOL_Y)
loss_count_s = min(n_s, ceil(loss_hp_s / hp_s))
n_s = n_s - loss_count_s
```

保证每种兵种至少保留 `min_troops_per_type` 的约束 **不适用于战斗**（可归零）；该键仅供募兵下限 elsewhere。

## 6. 回合流程

```text
round = 0
while round < max_rounds:
  if 任一方 N == 0: break
  round += 1
  按 speed 加权的平均速度决定先攻方：
    speed_X = Σ (n_t * speed_t) / N_X
  if speed_X > speed_Y: 先 X→Y，再 Y→X
  else if speed_X < speed_Y: 先 Y→X，再 X→Y
  else: 同时段内先攻方 id 小者先（实现用 battle_id 字典序）
  每段攻击后若 N == 0 则 break
```

【数值】来源：`params.yml → combat.max_rounds`  
【调参】减少 `max_rounds` 可缩短战报；典型 6–12。

## 7. 胜负判定

战斗终止时（一方兵力为 0 **或** 达到 `max_rounds`）：

1. **一方 N == 0**：另一方 **胜**；兵力为 0 方 **败**。
2. **双方 N > 0**（打满回合）：比较剩余生命池  
   `HP_REM = Σ (n_t * hp_t)`  
   - `HP_REM` 高者 **胜**  
   - 相等：**防守方胜**（`defender` 为输入字段，攻方为先发起战斗的一方）

战报须记录：每回合双方兵力快照、总伤害、最终 `result` ∈ {`attacker_win`,`defender_win`}、各方伤亡 `casualties`。

## 8. 实现检查清单

- [ ] 克制矩阵与 `counter_edges` 一致  
- [ ] 伤害公式使用 `ATK_POOL`/`DEF_POOL`，含将领与士气乘子  
- [ ] 回合顺序由速度决定，同速用 `battle_id` 破 tie  
- [ ] 胜负符合 §7，打满回合守方优势  
