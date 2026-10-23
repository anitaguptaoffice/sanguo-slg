# 社交与选服规则（M3 / SPEC-005）

军团、聊天、排行快照与选服列表的数据边界。实现方消费 `spec/db/m3_*.sql` 与 SPEC-001 账号表。

## 1. 分服 vs 单服写边界

| 数据 | 存储 | 谁写 | 分片键 |
|---|---|---|---|
| `account` / `account_session` | 账号中心 PG | 登录网关、账号服 | 无（全局） |
| `game_server` 元数据 | 账号中心或运维 PG | 开服工具、运维；`player_count`/`online_count` 由各游戏服 **异步上报** | `server_id` 主键 |
| `player` 及 M1–M2 玩家态表 | 游戏服 PG | **仅本 `server_id` 进程** | `server_id` |
| `guild` / `guild_member` | 游戏服 PG | 本服军团逻辑 | `server_id` |
| `chat_*` | 游戏服 PG（M3） | 本服聊天服或游戏服内模块 | `server_id` |
| `rank_snapshot*` | 游戏服 PG | 本服定时任务批量写入 | `server_id` |

**硬约束**

- 禁止跨 `server_id` 写入或关联：私聊双方必须同服；军团仅本服玩家；世界频道仅本服。
- `game_server` 选服字段为 **读多写少**：列表 API 读账号库；游戏服不得直接改他服行。
- 排行 **实时榜**（Redis 等）与 **快照表** 分离：快照为定时落库供历史/离线展示；实现可双写，但 PG 契约以 `rank_snapshot` 为准。

## 2. 选服列表

客户端拉取 `list_visible = true` 的 `game_server`，按 `sort_weight DESC`、`opened_at` 排序。

| `status`（SPEC-001） | 展示 |
|---|---|
| 0 维护 | 不可进，展示 `maintenance_msg` |
| 1 流畅 / 2 火爆 | 可进；`player_count >= max_players` 时客户端可显示爆满 |
| 3 停服 | 不展示或灰显 |

【调参】`max_players`、`sort_weight`、`is_recommend` 由运维或开服配置写入，非战斗公式。

## 3. 军团

- 创建军团：创建者 `role=1`（盟主），写入 `guild` + `guild_member`。
- 一玩家一军团：`guild_member` 主键 `(server_id, player_id)`。
- `role` 默认权限模板（实现可读配置）；`permissions` 位掩码覆盖单项授权。
- 解散/转让：更新 `guild.leader_player_id` 与成员 `role`，无跨服迁移（M3）。

## 4. 聊天频道

| `channel_type` | 含义 | `ref_id` |
|---|---|---|
| 1 世界 | 每服唯一频道 | 0 |
| 2 军团 | 每 `guild_id` 一条 | `guild_id` |
| 3 私聊 | `chat_private_pair` 规范化玩家对 | 经 `channel_id` 关联 |

消息长度上限与 DDL `content VARCHAR(500)` 一致；敏感词、频率限制在实现层，本契约不表。

## 5. 排行快照

| `rank_type` | `subject_id` | `score` 含义 |
|---|---|---|
| 1 玩家战力 | `player_id` | `player.power` 或等价 |
| 2 玩家等级 | `player_id` | `player.level`（同分按 tie-break 实现约定） |
| 3 军团战力 | `guild_id` | `guild.power` |

刷新流程：

1. 从实时源计算 Top-N（N 由实现配置，建议 100–200）。
2. 插入新 `batch_id = max(batch_id)+1` 的 `rank_snapshot` 与 `rank_snapshot_entry` 行。
3. 旧批次保留策略由实现决定（M3 不强制删除）。

客户端默认读 **最新** `batch_id`（`refreshed_at` 最大）；需要时可按 `batch_id` 查历史。

## 6. 版本

- **SPEC-005 v1**：M3 单服社交与选服扩展；不含跨服聊天、全服统一榜、M4 活动榜（见后续 SPEC-006）。
