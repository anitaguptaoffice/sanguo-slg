# Sibling finalizer phase gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-PHASE-DRAIN-001)

**Not** adopted. Task: [#2863](https://github.com/anitaguptaoffice/sanguo-slg/issues/2863)（#2870 栈；#2855 为 #2831 栈平行登记）. Stacks [#2916](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_UNKNOWN_DRAIN.md) / [#2854](https://github.com/anitaguptaoffice/sanguo-slg/issues/2854). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2805/#2830/#2854/#2913 sibling finalizer-ending-unknown drain (no re-run). Does not close #2737–#2854 Acceptance.

**Invariants:** head strict-classified + sibling held lease (finalizer gap or `finalizer_begin` in-flight) blocks `declare_drained`; cleanup ≠ drain; sibling classify → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_phase_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-EFFECT-BEGIN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_BEGIN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_begin_drain`); stacks #2920 / #2863; does not close #2737–#2863 Acceptance (#2869).