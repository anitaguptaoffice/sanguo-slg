# DOM/API CreateNewCity chain online exclusion (SPEC-FIRST-CITY-LEDGER-DOM-API-CHAIN-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover, production drain/fence controller, browser/WS, or signed rollback artifact. [#2595](https://github.com/anitaguptaoffice/sanguo-slg/issues/2595); does not re-run [#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md) direct `CreateCityInTx` subprocess scenes.

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §9、§11；[FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.6 / §6.2。Disposable PG17 子进程经 `CreateNewCity` → `saveCityWithWorld` → `CreateCityInTx`（与 `handleCreateCity` 同链）；证明停在 API/DOM 入口。

| 场景 | 要点 |
|------|------|
| `dom_chain_no_visible_first_city` | DOM/API 链不得留下可见新首次建城；保留行不变 |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开或复用 `command_id` |
| `table_lock_alone_not_dom_entry_stopped` | 仅 `player_city` 行锁不能宣称 DOM 入口已停 |
| `dom_chain_no_false_drain` | 链事务活跃时不得假排空 |
| `lawful_multi_city_not_blocked` | 合法非首都分城不得误伤 |

**另卡：** realm 认证、drain/fence 生产控制器、§11 browser、签名 rollback、OID §6 其余行（含 §6.3 GM/import — [GM-IMPORT-EXCLUSION-001](FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md)）。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_dom_api_chain_exclusion
```
