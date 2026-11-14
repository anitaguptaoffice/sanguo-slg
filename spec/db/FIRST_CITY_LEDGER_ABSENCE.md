# Absence / in-flight lookup matrix (SPEC-FIRST-CITY-LEDGER-ABSENCE-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task
[#2585](https://github.com/anitaguptaoffice/sanguo-slg/issues/2585). Stacks
[#2584](https://github.com/anitaguptaoffice/sanguo-slg/pull/2584) /
[#2583](FIRST_CITY_LEDGER_INITIAL.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §5 item 4、§6 continuation、§8
poison/unknown 保留、[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4（不得从瞬时缺席推断 Head EMPTY）与 §11 **absence**
行。Disposable PG17 harness：独立观察者连接、真实事务、可读 `world_first_city_command` / slot head /
harness `city_name`+`map_x`/`map_y`（仅夹具表）。

## In scope (this card only)

| Obligation | Harness proof |
|------------|----------------|
| 旧接收事务未提交时另一连接 lookup miss / 瞬时缺行 | 不得当成已认证 EMPTY；不得接受新 EMPTY INITIAL；不得换新 command ID 或坐标 |
| 旧事务已写入 PENDING（含锁边界等待后可见） | 保留原 command ID 与城名坐标；不得另起第二城 |
| PENDING continuation | 相同 advisory xact lock + slot `FOR UPDATE` 等待旧事务结束；`COMMIT` 后读到原命令与原身份 |
| source/command ending 仍为 unknown | lookup/continue 路径上的本地 lease release、cleanup、timeout 标志不得把行清成 EMPTY 或换身份 |

## Out of scope (frozen elsewhere)

- [#2584](FIRST_CITY_LEDGER_INITIAL.md) / `first_city_ledger_initial`：INITIAL 接收仲裁（含未提交 intake 第二份等待、双提案 canonical winner、lineage 拒 EMPTY）
- [#2578](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md)：drain 完成、close/poison 排空、确认排空后新 generation 继续（本卡只补 lookup/continue 不得本地清除）
- [#2568](FIRST_CITY_LEDGER_SLOT_CAS.md)、[#2580](FIRST_CITY_LEDGER_ACK_LOSS.md)、[#2566](FIRST_CITY_LEDGER_EFFECT_PATH.md) 等已冻矩阵
- §11 retention/cutover 全矩阵、§5.8 损坏/restore EMPTY 资格、真实 WebSocket / `cmd/server` / 浏览器、`internal/api/fresh_admission.go`
- 生产 DDL、`player_city_id_seq` 激活、新 wire 字段或 `durable_state` / `rejection_reason` 取值

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_absence
```

Record `SHOW server_version` and each `PASS absence:` line. Does **not** certify any target realm, deploy admission
controller, or complete §11 native product acceptance.

## Follow-on

§11 retention/cutover — [#2587](https://github.com/anitaguptaoffice/sanguo-slg/issues/2587) /
[FIRST_CITY_LEDGER_RETENTION_CUTOVER.md](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md). Native browser、realm drain/fence 生产控制器 — separate SPEC cards.
