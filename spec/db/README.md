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

在独立 schema 中执行各 `00*.sql`；优先本机 `psql`，否则 `sudo -u postgres psql`，再否则 Docker `postgres:16-alpine`。
