# Snapshot flusher / async persistence online exclusion (SPEC-FIRST-CITY-LEDGER-SNAPSHOT-FLUSH-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, drain/fence controller, browser/WS, signed rollback, or target-realm auth. [#2599](https://github.com/anitaguptaoffice/sanguo-slg/issues/2599); does not re-run [#2598](FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md)、[#2596](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md)、[#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md)、[#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) 已冻场景。

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6.5；FIRST_CITY_LEDGER 保留行。

**入口：** `internal/domestic/service.go` `Hub.maybeFlushAll`→`SettleCity`；`pg_store.go` `SaveCity`（wallet/城市行，可无 ledger 感知）；无独立 `cmd/` flusher。Harness `flush_worker` 为异步落盘代表（`player_wallet`+`player_city`），非 #2598 批导入。

| 场景 | 要点 |
|------|------|
| `snapshot_flush_no_visible_first_city` | 落盘不得留下可见新首次建城 |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_flush_entry_stopped` | 仅 ledger 锁或 legacy/dom/gm 已停标记不足 |
| `snapshot_flush_no_false_drain` | 落盘事务活跃时不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** realm 认证、生产 drain/fence、§11 browser、签名 rollback、OID §6 第 7/10/12 行等。§6.6 backup restore / retention job — [RESTORE-JOB-EXCLUSION-001](FIRST_CITY_LEDGER_RESTORE_JOB_EXCLUSION.md)。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_snapshot_flush_exclusion
```
