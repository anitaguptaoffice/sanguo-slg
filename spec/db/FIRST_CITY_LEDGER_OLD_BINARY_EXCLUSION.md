# Old writer / rollback binary exclusion (SPEC-FIRST-CITY-LEDGER-OLD-BINARY-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover-enabled, or production rollback artifact. [#2593](https://github.com/anitaguptaoffice/sanguo-slg/issues/2593); does not re-run [#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) five scenes.

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §9、§11；[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2；[FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.6 / §6.1+11。

Disposable PG17：子进程真实调用 `internal/world/city_creation.go` `CreateCityInTx`（legacy writer）；`rollback_prior` 子进程代表 prior-release 旧 binary（生产签名 rollback 制品现场排他 — 另卡）。

| 场景（harness 名） | 证明要点 |
|------|----------|
| `legacy_writer_no_visible_first_city` | 排他下已有保留首城时 legacy writer 不得留下可见新首次建城；command 与 `player_city` 保留行数不变 |
| `no_empty_reopen_or_command_id_reuse` | 保留线不得将 actor slot 头重开为 EMPTY；不得复用已保留 `command_id` |
| `rollback_prior_release_no_retention_violation` | prior-release rollback 代表不得破坏保留首城与 slot 绑定；head 仍绑原命令 |
| `old_binary_no_false_drain` | legacy 持锁活跃时不得以 profile/drain bump 假排空解锁 EMPTY intake；legacy 结束后方可合法 EMPTY |
| `lawful_multi_city_not_blocked` | 排他下非首都分城经 legacy `CreateCityInTx` 仍可提交；不误伤合法多城 |

**Follow-on:** OID §6.2 DOM/API 链排他 — [DOM-API-CHAIN-EXCLUSION-001](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md)（`first_city_ledger_dom_api_chain_exclusion`）；OID §6.11 生产签名 rollback 制品级 apply — [SIGNED-ROLLBACK-EXCLUSION-001](FIRST_CITY_LEDGER_SIGNED_ROLLBACK_EXCLUSION.md)（`signed_rollback_apply_worker`；非 `rollback_prior`）；本子进程入口不重跑。

**Out of scope:** [#2592](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md)–[#2584](FIRST_CITY_LEDGER_INITIAL.md) 已冻场景与五场景不重跑；`cmd/server`、WS/浏览器、§10.5–7、`fresh_admission`、realm 认证、生产 drain/fence 控制器、部署与 cutover。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_old_binary_exclusion
```

记录 `SHOW server_version` 与各 `PASS old_binary_exclusion:` 行。
