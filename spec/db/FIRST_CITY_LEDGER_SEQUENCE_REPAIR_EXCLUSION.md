# Standalone nextval / setval / sequence repair online exclusion (SPEC-FIRST-CITY-LEDGER-SEQUENCE-REPAIR-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, drain/fence controller, browser/WS, signed rollback, target-realm auth, or `player_city_id_seq`. [#2605](https://github.com/anitaguptaoffice/sanguo-slg/issues/2605); does not re-run [#2553](FIRST_CITY_LEDGER_DDL.md)–[#2604](FIRST_CITY_LEDGER_DDL_EXCLUSION.md) 已冻场景。

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6 **第 8 行**；[WORLD_CITY_IDENTITY.md](../rules/WORLD_CITY_IDENTITY.md) §3。

**基线入口（只读）：** `internal/world/city_sequence.go`（`pg_catalog.nextval`）；`internal/military/march/recruit_prepare.go`、`march_store.go`（queue nextval）；`spec/db/m4_005`–`m4_008`（迁移内 forward-only `setval`）；`cmd/`、`tools/` 无独立序列维护子命令。**Harness `seq_repair_worker`**（`city_nextval|setval|repair`、`queue_nextval|setval|repair`）为代表进程，非生产控制器。

| 场景 | 要点 |
|------|------|
| `seq_repair_no_visible_first_city` | 不得可见新首次建城 / 丢 ledger / 降高水位 |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_seq_repair_entry_stopped` | 仅 ledger 锁或 #2594–#2604 已停不足；仅停 city nextval 而 setval/queue live 不足 |
| `seq_repair_no_false_drain` | `nextval` 落盘后不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** realm、drain/fence、§11 browser、rollback、OID §6 第 10–12 行、`player_city_id_seq`。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_sequence_repair_exclusion
```
