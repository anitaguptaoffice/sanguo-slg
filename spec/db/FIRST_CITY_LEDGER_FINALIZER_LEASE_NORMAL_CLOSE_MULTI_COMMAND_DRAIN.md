# Multi-command known endings gate drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-MULTI-COMMAND-DRAIN-001)

**Not** adopted or production-enabled. Task: [#2773](https://github.com/anitaguptaoffice/sanguo-slg/issues/2773). Stacks [#2769](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8 (`declare_drained` requires **every** command `ending` known on the source). Complements [#2769](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md) single-command strict classify drain; not [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) simplified-lease five scenarios / not [#2753](FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md) classify timing re-run. Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767 Acceptance.

**Invariants:** head strict-classified + sibling `pending` blocks drain; cleanup alone ≠ drain; all commands known + head strict-classified → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_multi_command_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.