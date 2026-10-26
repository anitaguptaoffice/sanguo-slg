# 数据库 DDL（SPEC-001）

PostgreSQL 16+。**分片键 `server_id`**：账号中心与 `cfg_*` 全局表无 `server_id`；玩家态/地图态表均含 `server_id`。

待独立评审：[自然招募原子提交与将领创建身份契约](recruit_atomicity.md)（SPEC-RECRUIT-ATOMIC-001；非已上线保证）。

将领 ID 有序迁移候选及停写/恢复门禁：[SPEC-RECRUIT-ID](recruit_id_sequence.md)。

既有 work_queue 共享 JS-safe 身份分配与停写/恢复门禁：[SPEC-QUEUE-ID](../rules/queue_identity.md)。
仅契约前置，不启用新队列类型；隔离 PG 校验：
`QUEUE_ID_TEST_DSN=<disposable DSN> python3 spec/db/tests/queue_id.py`。
同一显式隔离 DSN 下继续运行 `python3 spec/db/tests/queue_id_metadata.py` 与
`go run ./spec/db/tests/queue_id_loader`，分别验证拒绝错误元数据/影子对象及真实 ApplySpecs 重放。
Loader 需显式隔离管理员 DSN：会创建并清理自己的 NOLOGIN 测试角色和数据库，
验证非超级用户数据库所有者在未改动 public 上的真实 ApplySpecs；不 GRANT/ALTER OWNER。

既有来投/俘虏/名将元数据独立契约候选及迁移门禁：[SPEC-HERO-METADATA](hero_metadata.md)。

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

## Fractional production checkpoint (proposed DOM-PRODUCTION-001)

`007_domestic_production_checkpoint.sql` adds a dedicated city accrual clock and
four bounded remainders. [Contract and rollout requirements](PRODUCTION_CHECKPOINT.md)
are review prerequisites; the schema alone does not repair any runtime behavior.
Existing cities require the separately gated, atomic all-city backfill in
`migrations/007_backfill_city_production_checkpoint.sql` before consumer activation;
run its isolated PostgreSQL acceptance checks with
`DATABASE_URL=... bash spec/db/tests/production_checkpoint_backfill.sh`.

Catalog-shadow correction for `m4_005`/`m4_006`/`m4_007`: trusted validation uses
`pg_catalog, pg_temp` with the temporary schema explicitly last, not implicit-first.
Exact cycling-sequence and wrong-default spoofs are tested with an explicit private DSN:
`SPEC_CATALOG_SHADOW_TEST_DSN=... python3 spec/db/tests/stable_catalog_shadow.py`.
This changes no schema, economics, legacy adoption or runtime activation policy.
