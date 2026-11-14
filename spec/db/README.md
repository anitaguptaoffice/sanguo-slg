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

## March persistence identity (SPEC-MARCH-PERSIST-001)

[契约与恢复规则](../rules/MARCH_PERSISTENCE.md) 与
`m4_009_march_identity.sql` 冻结行军持久化的最小身份/恢复面：三条 JS-safe 序列
（`march_order_march_id_seq`、`field_army_army_id_seq`、
`battle_report_report_id_seq`，上限 `9007199254740991`，OWNED BY NONE），
`march_order.origin_city_id` / `return_finish_at` 可空新列，返回期限部分索引
`idx_march_return`，以及 status 1/2/3/4 语义（3 由原“撤回”明确重定义为
returning；原值无 writer）。归属仍为
`march_order.army_id → field_army.owner_player_id`，不新增 player 列或 FK。

仅契约前置：不新增 Go writer、不写行、不加 `NOT NULL`、不做数据迁移/回填。
`ApplySpecs` 的 body 与 ledger 分开执行，缺 ledger 的重放必须幂等且不重置序列；
运行期禁止 `setval`/provision/repair，首个 writer 另行做 watermark 审计。
影响域/卡：MIL M1/M2/M5、API M3/M6、HERO M4 及未来 APP activation；本文件不授权
任何实现。

## First-city WORLD ledger (SPEC-FIRST-CITY-LEDGER-DDL-001)

[契约与 CAS / 锁强度说明](FIRST_CITY_LEDGER.md) 与 `m4_010_first_city_ledger.sql` 冻结
`world_first_city_command` 与 `world_first_city_actor_slot`：稳定 slot 键
`realm_id + server_id + player_id`、不可回收 `command_id`、当前 head、`canonical_c1`、
接收时 FCT1 模板、`PENDING` / `SUCCEEDED` / `REJECTED_NO_EFFECT` 及成功/拒绝 receipt 列。
**仅契约前置**：不实施 runtime、不认证目标 realm、不授权 cutover；`002_world.sql` 无 realm 列。
OID/profile 与写入者清单：[SPEC-FIRST-CITY-LEDGER-OID-PROFILE-001](FIRST_CITY_LEDGER_OID_PROFILE.md)。
全局 pin 序：[SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001](FIRST_CITY_LEDGER_GLOBAL_PINS.md)；
PG companion：[SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001](FIRST_CITY_LEDGER_PG_COMPANION.md)；
ApplySpecs loader 与隔离验收：[SPEC-FIRST-CITY-LEDGER-LOADER-001](FIRST_CITY_LEDGER_LOADER.md)（`go run ./spec/db/tests/first_city_ledger_loader`，需 `ALLOW_OWNED_PG17_TEST=1` 与 disposable DSN）。
Effect/finalizer 并发 race（companion §5.3 核心矩阵）：[SPEC-FIRST-CITY-LEDGER-RACE-001](FIRST_CITY_LEDGER_RACE.md)（`go run ./spec/db/tests/first_city_ledger_race`，同上 DSN 约定；不启用 `player_city_id_seq`）。
含 wallet/MIL/DOM 业务行的完整 effect 路径并发：[SPEC-FIRST-CITY-LEDGER-EFFECT-PATH-001](FIRST_CITY_LEDGER_EFFECT_PATH.md)（`go run ./spec/db/tests/first_city_ledger_effect_path`）。
缺行 slot / head 竞争 intake 与 predecessor CAS：[SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001](FIRST_CITY_LEDGER_SLOT_CAS.md)（`go run ./spec/db/tests/first_city_ledger_slot_cas`）。
跨 actor slot 隔离矩阵：[SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001](FIRST_CITY_LEDGER_SLOT_ISOLATION.md)（`go run ./spec/db/tests/first_city_ledger_slot_isolation`，同上 DSN 约定）。
同 PK `ID_CONTENT_CONFLICT` / 同 C1 只读路径：[SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md)（`go run ./spec/db/tests/first_city_ledger_id_content_conflict`）。
每 slot 至多一个 PENDING 部分唯一索引：[SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md)（`go run ./spec/db/tests/first_city_ledger_pending_unique_index`，无 DSN 时 SKIP）。
受限角色 ACL / 权限分离：[SPEC-FIRST-CITY-LEDGER-ACL-001](FIRST_CITY_LEDGER_ACL.md)（`go run ./spec/db/tests/first_city_ledger_acl`，同上 DSN 约定）。
事务局部 `validate_only` GUC：[SPEC-FIRST-CITY-LEDGER-VALIDATE-ONLY-001](FIRST_CITY_LEDGER_VALIDATE_ONLY.md)（`go run ./spec/db/tests/first_city_ledger_validate_only`，同上 DSN 约定；非生产启用/enrollment）。
`player_city_id_seq` 对象契约与隔离 PG17 序列验收：[SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001](FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md)（`go run ./spec/db/tests/first_city_ledger_player_city_id_seq`，同上 DSN 约定；非生产激活/runtime 分配器）。
效果 rollback→finalizer crash gap（§10 第 3 项切片，非 ATOMICITY 重做）：[SPEC-FIRST-CITY-LEDGER-CRASH-GAP-001](FIRST_CITY_LEDGER_CRASH_GAP.md)（`go run ./spec/db/tests/first_city_ledger_crash_gap`，同上 DSN 约定）。
finalizer 账号绑定/封禁 fail-closed（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-ACCOUNT-BLOCK-001](FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_account_block`，同上 DSN 约定）。
finalizer rollback→finalizer 间隙地形翻转（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-TERRAIN-GAP-001](FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_terrain_gap`，同上 DSN 约定）。
finalizer 终端 commit 不明 → poison（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-COMMIT-UNCERTAIN-POISON-001](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_commit_uncertain_poison`，同上 DSN 约定；disposable gate 夹具）。
finalizer 终端收据不得解除竞争者 uncertain 下 source drain（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-RECEIPT-NO-SOURCE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_receipt_no_source_drain`，同上 DSN 约定；disposable gate/command 夹具）。
source poison / 代际漂移下陈旧 rollback 证据不得启动 finalizer（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-STALE-EVIDENCE-001](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_stale_evidence`，同上 DSN 约定；disposable gate/command/evidence 夹具）。
effect/intake commit 不明不得作为 narrow finalizer rollback 证明（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-EFFECT-UNCERTAIN-NO-PROOF-001](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_effect_uncertain_no_proof`，同上 DSN 约定；disposable gate/effect-ending 夹具）。
finalizer 须匹配当前 head、拒绝不得推进 successor（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-NOT-CURRENT-HEAD-001](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_not_current_head`，同上 DSN 约定）。
已提交终态不得被后续窄 finalizer 覆盖（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-PRESERVE-TERMINAL-001](FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_preserve_terminal`，同上 DSN 约定）。
effect rollback 后须在同一 generation-bound lease 上继续 finalizer Begin（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-CONTINUITY-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_continuity`，同上 DSN 约定；disposable gate/lease 夹具）。
效果事务仍 open 时不得提前分类 lease ended / 放行 finalizer（§10 第 3 项切片）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary`，同上 DSN 约定）。
`effect_ending=unknown` 时不得分类 lease ended（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-UNKNOWN-ENDING-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary_unknown_ending`，同上 DSN 约定；不重跑 #2738 三场景）。
finalizer 阶段未完成时不得分类 lease ended（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-PHASE-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_PHASE.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_finalizer_phase`，同上 DSN 约定；不重跑 #2738/#2742 场景）。
`finalizer_ending=unknown` 时不得分类 lease ended（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-ENDING-UNKNOWN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_finalizer_ending_unknown`，同上 DSN 约定；不重跑 #2746 三场景）。
同源 sibling 命令 `ending=unknown` 时不得分类 lease ended（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SIBLING-UNKNOWN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_sibling_unknown`，同上 DSN 约定；不重跑 #2577/#2710）。
source `admission=poisoned` 时不得分类 lease ended（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SOURCE-POISONED-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_SOURCE_POISONED.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_source_poisoned`，同上 DSN 约定；不重跑 #2577/#2575/#2713）。
正常 close（`admission=closed`）下 head ready 时 held lease 可 classify（§10 第 3 项 follow-on）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close`，同上 DSN 约定；不重跑 #2757/#2575）。
正常 close strict classify 后方可 `declare_drained`：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_drain`，同上 DSN；不重跑 #2762/#2577）。sibling `unknown` drain 门槛（叠 #2774）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_unknown_drain`，同上 DSN；不重跑 #2774/#2753）。source `admission=poisoned` drain 门槛（叠 #2778）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SOURCE-POISONED-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SOURCE_POISONED_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_source_poisoned_drain`，同上 DSN；不重跑 #2778/#2757）。head `effect_ending=unknown` drain 门槛（叠 #2782）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_unknown_drain`，同上 DSN；不重跑 #2782/#2739）。head `finalizer_ending=unknown` drain 门槛（叠 #2789）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_ending_unknown_drain`，同上 DSN；不重跑 #2789/#2747）。open effect txn drain 门槛（叠 #2794）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-TXN-OPEN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_TXN_OPEN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_txn_open_drain`，同上 DSN；不重跑 #2794/#2738）。finalizer 阶段 gap/在途 drain 门槛（叠 #2798）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-PHASE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_PHASE_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_phase_drain`，同上 DSN；不重跑 #2744/#2798）。`effect_begin` 在途 drain 门槛（叠 #2806）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-BEGIN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_BEGIN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_begin_drain`，同上 DSN；不重跑 #2797/#2805）。head `effect_ending=pending`（txn 已关）drain 门槛（叠 #2812）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_PENDING_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_pending_drain`，同上 DSN；不重跑 #2797/#2788/#2808）。head `finalizer_ending=pending`（effect 已 `known_rollback`）drain 门槛（叠 #2818）：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_PENDING_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_ending_pending_drain`，同上 DSN；不重跑 #2792/#2817）。sibling `finalizer_ending=pending` drain（叠 #2824）：[SIBLING-FINALIZER-ENDING-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_PENDING_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_pending_drain`；不重跑 #2823/#2774/#2775）。sibling `effect_ending=pending`（txn 已关）drain（叠 #2831）：[SIBLING-EFFECT-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_PENDING_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_pending_drain`；不重跑 #2817/#2830/#2774）。sibling `txn_open=true` drain（叠 #2838）：[SIBLING-EFFECT-TXN-OPEN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_txn_open_drain`；不重跑 #2797/#2834）。sibling `effect_ending=unknown`（txn 已关）drain（叠 #2843）：[SIBLING-EFFECT-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_unknown_drain`；不重跑 #2788/#2834/#2841）。sibling `finalizer_ending=unknown` drain（叠 #2849）：[SIBLING-FINALIZER-ENDING-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_unknown_drain`；不重跑 #2792/#2830/#2848）。sibling finalizer 阶段 drain（叠 #2855）：[SIBLING-FINALIZER-PHASE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_PHASE_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_phase_drain`；不重跑 #2805/#2830/#2854）。多 command ending 全 known：[SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-MULTI-COMMAND-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_MULTI_COMMAND_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_multi_command_drain`，同上 DSN；不重跑 #2769/#2577）。
狭义拒绝 finalizer 全 rollback / 白名单 / exact-attempt：[SPEC-FIRST-CITY-LEDGER-FINALIZER-ROLLBACK-001](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md)（`go run ./spec/db/tests/first_city_ledger_finalizer_rollback`）。
phase admission / lease / close-poison 线性化：[SPEC-FIRST-CITY-LEDGER-PHASE-ADMISSION-001](FIRST_CITY_LEDGER_PHASE_ADMISSION.md)（`go run ./spec/db/tests/first_city_ledger_phase_admission`，同上 DSN 约定；夹具表非生产 DDL）。
未知 drain / receipt≠排空证据：[SPEC-FIRST-CITY-LEDGER-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md)（`go run ./spec/db/tests/first_city_ledger_unknown_drain`，同上 DSN 约定）。
进程重启 / ACK-loss 持久读回：[SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001](FIRST_CITY_LEDGER_ACK_LOSS.md)（`go run ./spec/db/tests/first_city_ledger_ack_loss`，同上 DSN 约定；非 WebSocket / 浏览器矩阵）。
分屏障效果事务原子性（CITY_CREATION_RECOVERY §6/§11）：[SPEC-FIRST-CITY-LEDGER-ATOMICITY-001](FIRST_CITY_LEDGER_ATOMICITY.md)（`go run ./spec/db/tests/first_city_ledger_atomicity`，同上 DSN 约定；非 #2566 并发、非 #2580 ACK-loss）。
INITIAL 接收仲裁（CITY_CREATION_RECOVERY §5 / §11 INITIAL）：[SPEC-FIRST-CITY-LEDGER-INITIAL-001](FIRST_CITY_LEDGER_INITIAL.md)（`go run ./spec/db/tests/first_city_ledger_initial`，同上 DSN 约定；非 absence/retention/浏览器）。
瞬时缺行 / 在途 lookup·continuation（§11 absence）：[SPEC-FIRST-CITY-LEDGER-ABSENCE-001](FIRST_CITY_LEDGER_ABSENCE.md)（`go run ./spec/db/tests/first_city_ledger_absence`，同上 DSN 约定；不重跑 #2584 INITIAL / #2578 drain）。
保留/改绑/不完整 restore fail-closed（§9/§11 retention/cutover）：[SPEC-FIRST-CITY-LEDGER-RETENTION-CUTOVER-001](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md)（`go run ./spec/db/tests/first_city_ledger_retention_cutover`，同上 DSN 约定；非 realm 认证/生产 fence/浏览器）。
物理映射 / 持续 fence fail-closed（§9/§11 可隔离证明）：[SPEC-FIRST-CITY-LEDGER-MAPPING-FENCE-001](FIRST_CITY_LEDGER_MAPPING_FENCE.md)（`go run ./spec/db/tests/first_city_ledger_mapping_fence`，同上 DSN 约定；非生产旧 writer 在线排他/realm 认证/浏览器）。
旧连接 / 直接 SQL / 末事务排空（§9/§11 可隔离证明）：[SPEC-FIRST-CITY-LEDGER-ONLINE-EXCLUSION-001](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_online_exclusion`，同上 DSN 约定；非生产旧 binary 排他/realm 认证/浏览器）。

旧 writer 子进程：[OLD-BINARY-EXCLUSION-001](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_old_binary_exclusion`）。
DOM/API `CreateNewCity` 编排链子进程：[DOM-API-CHAIN-EXCLUSION-001](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_dom_api_chain_exclusion`）。
GM/import 维护批处理代表子进程：[GM-IMPORT-EXCLUSION-001](FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_gm_import_exclusion`）。
Snapshot flusher / 异步落盘代表子进程：[SNAPSHOT-FLUSH-EXCLUSION-001](FIRST_CITY_LEDGER_SNAPSHOT_FLUSH_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_snapshot_flush_exclusion`）。
Backup restore / retention 作业代表子进程：[RESTORE-JOB-EXCLUSION-001](FIRST_CITY_LEDGER_RESTORE_JOB_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_restore_job_exclusion`）。
Signed rollback 制品级 apply 代表子进程：[SIGNED-ROLLBACK-EXCLUSION-001](FIRST_CITY_LEDGER_SIGNED_ROLLBACK_EXCLUSION.md)（`go run ./spec/db/tests/first_city_ledger_signed_rollback_exclusion`；非生产签名制品）。
OID §6 第 12 行新 ledger intake/effect/finalizer 未授权-直至-义务门槛：[NEW-INTAKE-AUTHORIZATION-001](FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md)（`go run ./spec/db/tests/first_city_ledger_new_intake_authorization`；非生产新路径）。

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
