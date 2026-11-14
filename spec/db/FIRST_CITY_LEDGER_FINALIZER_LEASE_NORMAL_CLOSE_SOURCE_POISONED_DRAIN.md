# Source poisoned blocks drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SOURCE-POISONED-DRAIN-001)

**Not** adopted. Task: [#2780](https://github.com/anitaguptaoffice/sanguo-slg/issues/2780). Stacks [#2778](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_UNKNOWN_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2757 classify + #2778 sibling-unknown drain (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775 Acceptance.

**Invariants:** poisoned admission blocks `declare_drained` after strict classify + all command known; cleanup alone ≠ drain; `admission=closed` allows drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_source_poisoned_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [EFFECT-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_effect_unknown_drain`); does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780 Acceptance.