# Backup restore / retention job online exclusion (SPEC-FIRST-CITY-LEDGER-RESTORE-JOB-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, drain/fence controller, browser/WS, signed rollback, or target-realm auth. [#2601](https://github.com/anitaguptaoffice/sanguo-slg/issues/2601); does not re-run [#2588](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md) retention/cutover data matrix、[#2600](FIRST_CITY_LEDGER_SNAPSHOT_FLUSH_EXCLUSION.md)、[#2598](FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md)、[#2596](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md)、[#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md)、[#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) 已冻场景。

Normative: CITY_CREATION_RECOVERY §9 / §11（§11 中须对 backup restore / retention 作业证明的「实际旧 writer 被排除」部分）；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6.6；[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) ID retention；Full retention bundle §3.6。

**入口（基线 head 检索）：** `cmd/`、`tools/`、`internal/` **无**独立可调用的 WORLD 首城 backup restore / retention 生产子命令。`internal/military/march/*_restore*` 为行军域恢复，不触及 retention bundle。Harness `restore_job_worker` 为 backup restore / retention **代表进程**（对 ledger + slot + `player_city` + wallet + harness allocator 高水位做可提交写入），**非**生产 restore 控制器落地。

| 场景 | 要点 |
|------|------|
| `restore_job_no_visible_first_city` | 作业不得留下可见新首次建城、不得不完整 restore 丢 ledger、不得降 allocator |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_restore_job_entry_stopped` | 仅 ledger 锁或 #2594/#2596/#2598/#2600 已停标记不足 |
| `restore_job_no_false_drain` | 作业事务仍可能提交时不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** 目标 realm 认证、生产 drain/fence 控制器、§11 native browser、生产签名 rollback 制品现场排他、OID §6 第 7/10/12 行等。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_restore_job_exclusion
```
