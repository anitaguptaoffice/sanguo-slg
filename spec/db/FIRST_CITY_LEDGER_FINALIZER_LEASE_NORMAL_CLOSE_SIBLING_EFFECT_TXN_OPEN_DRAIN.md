# Sibling open effect txn gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-TXN-OPEN-DRAIN-001)

**Not** adopted. Task: [#2880](https://github.com/anitaguptaoffice/sanguo-slg/issues/2880)（#2870 栈；#2841 为 #2831 栈平行登记）. Stacks [#2906](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_PENDING_DRAIN.md) / [#2874](https://github.com/anitaguptaoffice/sanguo-slg/issues/2874). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2797/#2874/#2906 sibling effect-pending drain (no re-run). Does not close #2737–#2874 Acceptance.

**Invariants:** head strict-classified + sibling `txn_open=true` blocks `declare_drained`; cleanup ≠ drain; sibling txn closed `known_rollback` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_txn_open_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-EFFECT-UNKNOWN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_unknown_drain`); stacks #2909 / #2889; does not close #2737–#2880 Acceptance.