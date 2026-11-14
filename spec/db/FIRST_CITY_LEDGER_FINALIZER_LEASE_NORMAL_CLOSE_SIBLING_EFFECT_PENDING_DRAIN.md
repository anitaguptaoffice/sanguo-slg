# Sibling effect ending pending gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-PENDING-DRAIN-001)

**Not** adopted. Task: [#2874](https://github.com/anitaguptaoffice/sanguo-slg/issues/2874)（#2870 栈；#2834 为 #2831 栈平行登记）. Stacks [#2902](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_BEGIN_DRAIN.md) / [#2869](https://github.com/anitaguptaoffice/sanguo-slg/issues/2869). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2817/#2869/#2902 sibling effect_begin drain (no re-run). Does not close #2737–#2869 Acceptance.

**Invariants:** head strict-classified + sibling `txn_open=false` with `effect_ending=pending` blocks `declare_drained`; cleanup ≠ drain; sibling `effect_ending=known_rollback` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_pending_drain
```
No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-EFFECT-TXN-OPEN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_txn_open_drain`); stacks #2906 / does not close #2737–#2874 Acceptance (#2880).