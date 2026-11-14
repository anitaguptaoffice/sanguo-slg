# Sibling effect_begin gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-BEGIN-DRAIN-001)

**Not** adopted. Task: [#2869](https://github.com/anitaguptaoffice/sanguo-slg/issues/2869)（#2870 栈；#2864 为 #2831 栈平行登记）. Stacks [#2898](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_PHASE_DRAIN.md) / [#2863](https://github.com/anitaguptaoffice/sanguo-slg/issues/2863). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2808/#2863 sibling finalizer-phase drain (no re-run). Does not close #2737–#2863 Acceptance. **Invariants:** head strict-classified + sibling `effect_begin` in-flight blocks `declare_drained`; cleanup ≠ drain; sibling classify → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_begin_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-EFFECT-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_PENDING_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_pending_drain`); does not close #2737–#2869 Acceptance.