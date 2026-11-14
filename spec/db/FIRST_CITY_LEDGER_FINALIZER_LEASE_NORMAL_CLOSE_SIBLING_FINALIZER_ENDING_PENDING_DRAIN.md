# Sibling finalizer ending pending gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-ENDING-PENDING-DRAIN-001)

**Not** adopted. Task: [#2830](https://github.com/anitaguptaoffice/sanguo-slg/issues/2830). Stacks [#2824](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_PENDING_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2823/#2774/#2775 (no re-run). Does not close #2737–#2823 Acceptance.

**Invariants:** head strict-classified + sibling `finalizer_ending=pending` blocks `declare_drained`; cleanup ≠ drain; sibling `known_terminal` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_pending_drain
```
No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.