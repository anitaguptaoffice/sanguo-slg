# Head effect unknown gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-UNKNOWN-DRAIN-001)

**Not** adopted. Stacks [#2782](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SOURCE_POISONED_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2739 classify + #2782 source-poisoned drain (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780 Acceptance.

**Invariants:** head `effect_ending=unknown` blocks `declare_drained` after normal close; cleanup alone ≠ drain; resolved `known_rollback` + strict classify + all command known → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.