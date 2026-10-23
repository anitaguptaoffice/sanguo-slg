# 内政规则（v1）

单城视角：资源存量、资源建筑产出、建筑升级消耗/时间、建造队列。游戏服内存状态 + 调度服到期事件（见 `docs/ARCHITECTURE.md`）。

## 1. 资源类型

| 键名 | 中文 |
|---|---|
| `food` | 粮食 |
| `wood` | 木材 |
| `stone` | 石料 |
| `iron` | 铁锭 |

【数值】来源：`params.yml → domestic.resources`  
【调参】增删资源类型需同步 SPEC-001 DDL 与 SPEC-004 seed（本卡不改契约）。

## 2. 仓库上限

城池仓库容量（四类共享上限或分资源同值，M1 采用 **共享总 cap**）：

```text
cap = warehouse_cap_base + warehouse_cap_per_level * main_hall_level
```

每种资源 `stored_r <= cap`；产出溢出部分 **丢弃**（M1 不返还邮件）。

【数值】来源：`params.yml → domestic.warehouse_cap_base`, `warehouse_cap_per_level`  
【调参】提高 base 缓解早期爆仓；按官府等级线性扩容。

## 3. 资源产出（挂机）

### 3.1 生产建筑

| 建筑键 | 产出资源 | 配置路径 |
|---|---|---|
| `farm` | food | `domestic.production.farm` |
| `lumber` | wood | `domestic.production.lumber` |
| `quarry` | stone | `domestic.production.quarry` |
| `iron` | iron | `domestic.production.iron` |

每座建筑实例 `level >= 1` 时，**每小时产出**：

```text
bonus = 1 + production_bonus_per_level * max(0, main_hall_level - 1)
output_hour = floor(base_per_hour * level * bonus)
```

同一类型可多座（若玩法允许多实例）；总产出为各实例之和。

### 3.2 结算周期

调度 tick 间隔 `tick_interval_sec`（默认 1s）。每个 tick 对每座生产建筑：

```text
delta = output_hour / 3600 * tick_interval_sec
stored_resource += delta   # 浮点累加，展示时 floor；落库可保留小数
```

离线收益：按 **最后活跃时间 → 当前时间** 同公式积分，单次离线结算上限 **24 小时**（硬编码常数，调参入口见下）。

【数值】来源：`params.yml → domestic.production.*`, `main_hall.production_bonus_per_level`, `queue.tick_interval_sec`  
【调参】改 `base_per_hour` 调节经济节奏；`production_bonus_per_level` 强化官府优先级。  
【调参】离线上限 24h 在实现配置键 `domestic.offline_cap_hours`（默认 24，可不进 params.yml 首版）。

## 4. 建筑等级、消耗与时间

### 4.1 可建造类型

`params.yml → domestic.build.buildings` 定义：`main_hall`, `farm`, `lumber`, `quarry`, `iron`, `barracks`, `wall`。

升级 **到等级 L**（`L >= 1`，从 0→1 为建造）：

```text
cost_r = floor(base_cost[r] * cost_growth^(L-1))   # 每种资源 r
time_sec = floor(base_time_sec * time_growth^(L-1))
```

`base_cost` / `base_time_sec` 取自对应建筑键。

### 4.2 前置（M1）

| 规则 | 说明 |
|---|---|
| 官府 | 任意建筑升级后等级 `<= main_hall_level` |
| 兵营 | `main_hall_level >= 2` 方可建造 1 级 |
| 城墙 | `main_hall_level >= 3` 方可建造 1 级 |

更高等级前置（科技树）v1 不启用。

【数值】来源：`params.yml → domestic.build.cost_growth`, `time_growth`, `buildings.<id>.*`  
【调参】`cost_growth` 控制后期资源压力；`time_growth` 控制后期等待时长。

## 5. 建造队列

### 5.1 槽位

每城 `slots_default` 个 **建造队列槽**（M1 为 1）。每条队列项：

```text
QueueItem {
  building_id, target_level, started_at, finish_at, cost_paid
}
```

### 5.2 入队规则

1. 校验前置与资源 `stored_r >= cost_r`；不足则拒绝。  
2. 扣减资源（立即扣除全额 `cost`）。  
3. 若当前 **进行中** 项少于槽位数：立即 `started_at = now`，`finish_at = now + time_sec`。  
4. 否则：进入 **等待队列**（FIFO），`started_at` 在前一项 `finish_at` 之后顺延。

### 5.3 完成

当 `now >= finish_at`：建筑等级设为 `target_level`；若等待队列非空，下一项自动开始（`started_at = finish_at_prev`）。

### 5.4 取消

仅 **未开始**（等待中）或 **进行中** 可取消：

```text
refund_r = floor(cost_paid[r] * cancel_refund_ratio)
```

进行中超时部分 **不** 按比例缩短时间；取消后队列让出槽位，下一等待项开始。

【数值】来源：`params.yml → domestic.queue.slots_default`, `cancel_refund_ratio`  
【调参】`slots_default` 提升付费/科技扩展前先保持 1；`cancel_refund_ratio` 调节取消惩罚。

## 6. 与募兵的边界

兵营等级仅解锁募兵 **种类/上限**（由 MIL 任务定义）；本规格只保证 `barracks` 的建造消耗/时间在 `build.buildings.barracks`。

## 7. 实现检查清单

- [ ] 产出公式含官府 `production_bonus_per_level`  
- [ ] 升级消耗/时间按 `cost_growth^ (L-1)` 计算  
- [ ] 队列 FIFO、槽位、取消退款比例符合 §5  
- [ ] 仓库 cap 与溢出丢弃  
