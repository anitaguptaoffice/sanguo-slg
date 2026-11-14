# Sibling effect ending pending gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-PENDING-DRAIN-001)

**Not** adopted. Task: [#2834](https://github.com/anitaguptaoffice/sanguo-slg/issues/2834). Stacks [#2831](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_PENDING_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2817/#2830/#2774 (no re-run). Does not close #2737–#2830 Acceptance.

**Invariants:** head strict-classified + sibling `txn_open=false` with `effect_ending=pending` blocks `declare_drained`; cleanup ≠ drain; sibling `effect_ending=known_rollback` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_pending_drain
```
No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-EFFECT-TXN-OPEN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_txn_open_drain`); does not close #2737–#2834 Acceptance.