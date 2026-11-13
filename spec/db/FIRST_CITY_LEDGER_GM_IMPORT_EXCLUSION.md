# GM / import / batch SQL tool online exclusion (SPEC-FIRST-CITY-LEDGER-GM-IMPORT-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, drain/fence controller, browser/WS, signed rollback, or target-realm auth. [#2597](https://github.com/anitaguptaoffice/sanguo-slg/issues/2597); does not re-run [#2596](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md)、[#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md)、[#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) 已冻场景。

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.3 / §5.6 / §6.3；FIRST_CITY_LEDGER 保留行。

**入口：** 基线 `cmd/gm` 无 city-import；子进程为 `batch_worker`（维护角色 `player_city`+`player_wallet`+`mil_city_origin` 批写入代表，非生产 GM）。

| 场景 | 要点 |
|------|------|
| `gm_import_no_visible_first_city` | 批处理不得留下可见新首次建城 |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_gm_import_entry_stopped` | 仅 ledger 锁或 dom/legacy 已停标记不足 |
| `gm_import_no_false_drain` | 批处理事务活跃时不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** realm 认证、生产 drain/fence、§11 browser、签名 rollback、OID §6 第 5/6/7/10 行等。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_gm_import_exclusion
```
