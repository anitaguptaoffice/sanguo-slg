# ApplySpecs / manual migration / lazy store DDL online exclusion (SPEC-FIRST-CITY-LEDGER-DDL-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, drain/fence controller, browser/WS, signed rollback, target-realm auth, or OID §6 row 8 sequence repair. [#2603](https://github.com/anitaguptaoffice/sanguo-slg/issues/2603); does not re-run [#2561](FIRST_CITY_LEDGER_LOADER.md)、[#2553](FIRST_CITY_LEDGER_DDL.md)、[#2588](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md)、[#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md)–[#2602](FIRST_CITY_LEDGER_RESTORE_JOB_EXCLUSION.md) 已冻场景。

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6 **第 7 行**；FIRST_CITY_LEDGER ID retention。

**入口：** `internal/platform/db.ApplySpecs`；手工迁移 `spec/db/tests/recruit_storage_entry.sh` / `mil_city_origin_entry.sh`；lazy store DDL `hero_metadata.md` 旧 getter 模式。`cmd/`、`tools/` 无独立 WORLD 首城 DDL 子命令。Harness `ddl_worker` 为 **代表进程**（`apply_specs` \| `manual_migration` \| `lazy_store`；catalog/sequences + ledger 触及），非生产 migration controller。

| 场景 | 要点 |
|------|------|
| `ddl_no_visible_first_city` | 不得可见新首次建城 / 丢 ledger / 降 allocator |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_ddl_entry_stopped` | 仅 ledger 锁或 #2594–#2602 已停不足；仅停显式迁移而 lazy DDL live 不足；单 migration owner |
| `ddl_no_false_drain` | DDL 事务仍可能提交时不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** realm 认证、drain/fence 生产控制器、§11 browser、签名 rollback、OID §6 第 8 行见 [#2605](FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md) / 第 10 行见 [BACKGROUND_WRITER_EXCLUSION](FIRST_CITY_LEDGER_BACKGROUND_WRITER_EXCLUSION.md) / 第 12 行等。
```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_ddl_exclusion
```