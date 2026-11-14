# Sibling finalizer ending unknown gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-ENDING-UNKNOWN-DRAIN-001)

**Not** adopted. Task: [#2854](https://github.com/anitaguptaoffice/sanguo-slg/issues/2854)（#2870 栈；#2849 为 #2831 栈平行登记）. Stacks [#2913](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md) / [#2889](https://github.com/anitaguptaoffice/sanguo-slg/issues/2889). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2792/#2830/#2889/#2913 sibling effect-unknown drain (no re-run). Does not close #2737–#2889 Acceptance.

**Invariants:** head strict-classified + sibling `finalizer_ending=unknown` blocks `declare_drained`; cleanup ≠ drain; sibling `known_terminal` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-FINALIZER-PHASE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_PHASE_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_phase_drain`); stacks #2916 / #2863; does not close #2737–#2854 Acceptance.