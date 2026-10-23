# 任务、商城与发奖规则（M4 / SPEC-006）

任务链、商城购买、邮件附件与 **统一发奖队列** 的可执行边界。实现方消费 `spec/db/m4_*.sql` 与 `006_content.sql` 背包表。

## 1. 奖励包 JSON（唯一 schema）

任务 `cfg_quest.rewards`、邮件 `player_mail.attachments`、队列 `reward_grant_queue.rewards` 使用同一结构：

```json
{
  "resources": { "food": 1000, "wood": 500 },
  "items": [{ "item_cfg_id": 2001, "qty": 2 }]
}
```

- `resources` 键与内政钱包字段一致（`food` / `wood` / `iron` / `silver` 等，以实现为准）。
- `items` 写入 `player_item`，遵守 `cfg_item.max_stack`；溢出策略由 CONTENT-002 实现（邮件补发或失败入队重试）。
- 空奖励包 `{}` 合法（纯叙事邮件或标记型任务）。

## 2. 任务链

| 字段 | 含义 |
|---|---|
| `chain_id` | 同链任务共享；客户端可按链展示 |
| `prev_quest_cfg_id` | 前置任务 cfg id；**必须已完成（state=3）** 才可接取 |
| `sort_in_chain` | 同链排序，非接取顺序约束 |

**接取**

1. 校验 `player.level >= cfg_quest.unlock_level`。
2. 若 `prev_quest_cfg_id` 非空：对应 `player_quest.state = 3`，否则拒绝。
3. 若已有行且 `repeatable = false` 且 `state = 3`：拒绝重复接取。
4. 写入/更新 `player_quest`：`state=1`，`accepted_at=now()`，`progress` 清零或按配置初始化。

**进度**

- `objectives` 与 `progress` 键一一对应；事件驱动更新，全部达成后 `state=2`，`completed_at=now()`。

**领奖**

1. 仅 `state=2` 可领。
2. 入队 `reward_grant_queue`：`source_type=quest`，`source_ref` 含 `quest_cfg_id`，`idempotency_key` 建议 `quest:{player_id}:{quest_cfg_id}:claim`。
3. 队列处理成功（CONTENT-002）：`state=3`，`reward_claimed_at=now()`；失败保留 `state=2` 可重试。

## 3. 商城（无真实支付）

**展示**：按 `cfg_shop` → `cfg_shop_shelf`（`visible_from/until`）→ `cfg_shop_offer` 排序拉取。

**购买**

1. 校验货架可见、`player.level`、库存与限购（`player_shop_offer_counter` + `cfg_shop_offer.*_limit`）。
2. 扣 `price` 中的资源（钱包）与道具（`player_item`）；不足则整单失败。
3. 写 `player_shop_purchase` 流水；更新 counter。
4. 发货：入队 `reward_grant_queue`（`source_type=shop`，`source_ref` 含 `offer_cfg_id` 与 `purchase_id`），奖励为所购 `item_cfg_id` × `item_count`。
5. 客户端可选 `idempotency_key` 防双击；同键重复返回原 `purchase_id`。

全服库存 `server_stock_limit` 由实现原子扣减（Redis 或行锁计数表）；本 DDL 不单独建全服计数表。

## 4. 邮件

| `mail_type` | 用途 |
|---|---|
| 1 系统 | 运营/系统通知，可无附件 |
| 2 奖励 | 带 `attachments`，需领取 |
| 3 公告 | 只读展示 |

- 读信：`status` 0→1，`read_at` 写入。
- 领附件：仅 `attachments` 非空且未领；入队发奖（`source_type=mail`，`source_ref=mail_id`），成功后 `status=2`，`claimed_at` 写入。
- `expire_at` 过期后不可领附件；实现可定时清理 `status=3`。

## 5. 发奖队列

| `status` | 含义 |
|---|---|
| 0 待处理 | 可被 worker 拉取 |
| 1 处理中 | 防并发重复发放 |
| 2 成功 | `completed_at` 写入 |
| 3 失败 | 按 `next_retry_at` 退避重试 |

**幂等**：`(server_id, idempotency_key)` 唯一；重复 INSERT 应返回已有 `grant_id` 或由实现 UPSERT。

**消费方**：CONTENT-002 将 `rewards` 落入背包与钱包；QUEST-001 / SHOP-001 / GM-001 只入队或同步调用钩子，不直写他域表。

## 6. 与分片边界

`player_quest`、`player_shop_*`、`player_mail`、`reward_grant_queue` 均含 `server_id`，**仅本服进程写入**；`cfg_*` 全局只读。
