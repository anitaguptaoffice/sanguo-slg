# Finalizer strict classify gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-DRAIN-001)

**Not** adopted or production-enabled. Task: [#2767](https://github.com/anitaguptaoffice/sanguo-slg/issues/2767). Stacks [#2762](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8. Complements [#2762](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md) / [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) (no #2762/#2577 re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761 Acceptance.

**Invariants:** close+held lease blocks `declare_drained`; cleanup alone ≠ drained; strict classify+known ending → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.