# Sibling effect_begin gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-BEGIN-DRAIN-001)

**Not** adopted. Task: [#2869](https://github.com/anitaguptaoffice/sanguo-slg/issues/2869). Stacks [#2864](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_PHASE_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2808/#2864 (no re-run). Does not close #2737–#2863 Acceptance. **Invariants:** head strict-classified + sibling `effect_begin` in-flight blocks `declare_drained`; cleanup ≠ drain; sibling classify → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_begin_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.