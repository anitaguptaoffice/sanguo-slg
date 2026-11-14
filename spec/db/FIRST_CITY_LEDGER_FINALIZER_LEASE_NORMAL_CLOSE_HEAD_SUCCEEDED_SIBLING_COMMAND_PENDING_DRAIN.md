# Head SUCCEEDED + retained sibling command PENDING gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-HEAD-SUCCEEDED-SIBLING-COMMAND-PENDING-DRAIN-001)

**Not** adopted. Task: [#3018](https://github.com/anitaguptaoffice/sanguo-slg/issues/3018). Stacks [#3013](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_PENDING_SIBLING_SUCCEEDED_DRAIN.md) / [#3014](https://github.com/anitaguptaoffice/sanguo-slg/pull/3014). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6/§8/§9; complements [#2981](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_COMMAND_PENDING_DRAIN.md) head-REJECTED + sibling-PENDING (#2982) and [#3000](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_SUCCEEDED_SIBLING_SUCCEEDED_DRAIN.md) dual SUCCEEDED (#3000). Does not close #2737–#3013 Acceptance.

**Invariants:** dual strict classify + slot/evidence aligned; head `durable_state=2` does not excuse sibling ledger `durable_state=1` blocking `declare_drained`; cleanup ≠ drain; sibling ledger terminalization → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_head_succeeded_sibling_command_pending_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [HEAD-SUCCEEDED-SIBLING-HARNESS-ONLY-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_SUCCEEDED_SIBLING_HARNESS_ONLY_PENDING_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_head_succeeded_sibling_harness_only_pending_drain`); stacks #3023 / #3019; does not close #2737–#3018 Acceptance.