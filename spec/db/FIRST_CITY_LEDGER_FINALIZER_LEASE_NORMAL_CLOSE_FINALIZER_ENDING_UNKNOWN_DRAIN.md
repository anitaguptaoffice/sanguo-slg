# Head finalizer ending unknown gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-UNKNOWN-DRAIN-001)

**Not** adopted. Task: [#2792](https://github.com/anitaguptaoffice/sanguo-slg/issues/2792). Stacks [#2789](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2747 classify + #2789 effect-unknown drain (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788 Acceptance.

**Invariants:** head `finalizer_ending=unknown` (effect `known_rollback`) blocks `declare_drained` after normal close; cleanup alone ≠ drain; resolved `known_terminal` + strict classify + all command known → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_ending_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.