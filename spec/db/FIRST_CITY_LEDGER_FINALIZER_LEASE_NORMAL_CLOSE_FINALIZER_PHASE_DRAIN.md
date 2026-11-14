# Finalizer phase gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-PHASE-DRAIN-001)
**Not** adopted. Task: [#2805](https://github.com/anitaguptaoffice/sanguo-slg/issues/2805). Stacks [#2798](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_TXN_OPEN_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2744 + #2798 (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797 Acceptance.
**Invariants:** `effect_rollback_at` gap or in-flight `finalizer_begin` blocks `declare_drained` under normal close; cleanup ≠ drain; strict classify → drain + generation++.
```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_phase_drain
```
No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [EFFECT-BEGIN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_BEGIN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_effect_begin_drain`); does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797/#2805 Acceptance.