# Sibling unknown gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-UNKNOWN-DRAIN-001)

**Not** adopted. Task: [#2775](https://github.com/anitaguptaoffice/sanguo-slg/issues/2775). Stacks [#2774](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_MULTI_COMMAND_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2774 pending slice + #2753 classify (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773 Acceptance.

**Invariants:** head strict-classified + sibling `unknown` blocks drain; cleanup alone ≠ drain; sibling resolved unknown→known allows drain + generation++.
```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SOURCE-POISONED-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SOURCE_POISONED_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_source_poisoned_drain`); does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775 Acceptance.