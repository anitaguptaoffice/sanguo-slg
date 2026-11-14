# Background-writer online exclusion (SPEC-FIRST-CITY-LEDGER-BACKGROUND-WRITER-EXCLUSION-001)

**Not** deployed, realm, cutover, drain/fence controller, browser/WS, signed rollback, `player_city_id_seq`. [#2607](https://github.com/anitaguptaoffice/sanguo-slg/issues/2607); does not re-run [#2553](FIRST_CITY_LEDGER_DDL.md)–[#2606](FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md).

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6 **第 10 行**；[WORLD_CITY_IDENTITY.md](../rules/WORLD_CITY_IDENTITY.md) §2 / §3。

**基线（只读，同 DSN+schema）：** queues `internal/domestic/pg_store.go`（`work_queue.city_id`）；mail `internal/content/mail/pg_store.go`、`cmd/gm send-mail`；rank `internal/rank/pg_store.go`；chat `internal/chat/pg_store.go`；`cmd/`/`tools/` 无独立后台子命令。**Harness `bg_writer_worker`**（`queue|mail|rank|chat|isolated`）为代表进程，非生产控制器；`isolated` 写 `harness_isolated_catalog`（无 `server_id`/`city_id`）。

`bg_writer_no_visible_first_city` / `no_empty_reopen_or_command_id_reuse` / `table_lock_alone_not_bg_writer_entry_stopped` / `bg_writer_no_false_drain` / `lawful_multi_city_not_blocked`（同 [#2606](FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md) 五条结构，对象改为第 10 行后台 writer）。

**另卡：** realm、drain/fence、§11 browser、rollback、OID §6 第 11–12 行、`player_city_id_seq`。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_background_writer_exclusion
```
