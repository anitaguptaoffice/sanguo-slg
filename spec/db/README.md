# 数据库 DDL（SPEC-001）

PostgreSQL 16+。**分片键 `server_id`**：账号中心与 `cfg_*` 全局表无 `server_id`；玩家态/地图态表均含 `server_id`。

## ER（逻辑引用，跨域不设 FK）

- `account` → `player`（同服唯一角色）→ `player_wallet` / `player_city` / `player_hero`
- `player_city` → `city_building`、`city_troop`
- `field_army` → `army_troop`、`march_order` → `battle_report`
- `cfg_hero_template` → `player_hero`；`cfg_item` → `player_item`

## 索引策略

| 键 | 用途 |
|----|------|
| `(server_id, player_id)` | 玩家列表 |
| `(server_id, city_id)` | 城池建筑/驻防 |
| `(server_id, x, y)` UNIQUE | 地图占格 |
| `(server_id, status, finish_at)` / `arrive_at` | 队列/行军到期 |
| `(server_id, created_at)` | 战报时间范围 |
| `account(login_name)` UNIQUE | 登录 |

`battle_report` 量大时按 `created_at` RANGE 分区（实现阶段）。

## 校验

```bash
./spec/db/validate.sh
```

在独立 schema 中按序执行 `00*.sql`、`m3_*.sql`（M3）、`m4_*.sql`（M4）；优先本机 `psql`，否则 `sudo -u postgres psql`，再否则 Docker `postgres:16-alpine`。

## M3 扩展（SPEC-005）

| 文件 | 内容 |
|------|------|
| `m3_001_server_list.sql` | `game_server` 选服字段与列表索引 |
| `m3_002_guild.sql` | 军团与成员 |
| `m3_003_chat.sql` | 频道、私聊对、消息 |
| `m3_004_rank.sql` | 榜单批次与条目 |

M4 及以后里程碑使用独立 `m4_*.sql` 等前缀，避免与并行 DDL 冲突。

## M4 扩展（SPEC-006）

| 文件 | 内容 |
|------|------|
| `m4_001_quest.sql` | `cfg_quest` 链式前置、`player_quest` 时间戳 |
| `m4_002_shop.sql` | 商城、货架、商品、购买与限购计数 |
| `m4_003_mail_reward.sql` | 邮件、待发奖队列 |

逻辑引用：`cfg_shop_offer.item_cfg_id` → `cfg_item`；发奖 JSON 与 `cfg_quest.rewards` / `player_mail.attachments` 同 schema（见 `spec/rules/content.md`）。
