# Head finalizer ending pending gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-PENDING-DRAIN-001)

**Not** adopted. Task: [#2823](https://github.com/anitaguptaoffice/sanguo-slg/issues/2823). Stacks [#2818](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_PENDING_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2792 finalizer-unknown + #2817 effect-pending (no re-run). Does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797/#2805/#2808/#2817 Acceptance.

**Invariants:** effect `known_rollback` with head `finalizer_ending=pending` blocks `declare_drained` under normal close; cleanup ≠ drain; classify `known_terminal` + strict classify → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_ending_pending_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-FINALIZER-ENDING-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_PENDING_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_pending_drain`); does not close #2737–#2823 Acceptance.