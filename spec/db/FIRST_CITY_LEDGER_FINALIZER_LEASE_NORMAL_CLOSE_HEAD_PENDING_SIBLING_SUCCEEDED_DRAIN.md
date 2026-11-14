# Head PENDING + retained sibling SUCCEEDED gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-HEAD-PENDING-SIBLING-SUCCEEDED-DRAIN-001)

**Not** adopted. Task: [#3013](https://github.com/anitaguptaoffice/sanguo-slg/issues/3013). Stacks [#3008](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_TERMINAL_SIBLING_SUCCEEDED_DRAIN.md) / [#3007](https://github.com/anitaguptaoffice/sanguo-slg/issues/3007). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6/§8/§9; complements [#3008](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_TERMINAL_SIBLING_SUCCEEDED_DRAIN.md) head-terminal + sibling-SUCCEEDED (#3007) and [#2986](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_PENDING_SIBLING_TERMINAL_DRAIN.md) head-PENDING + sibling-REJECTED (#2984). Does not close #2737–#3007 Acceptance.

**Invariants:** dual strict classify + slot/evidence aligned; head `durable_state=1` blocks `declare_drained` despite retained sibling `durable_state=2`; cleanup ≠ drain; unresolved harness pending/unknown still blocks; head ledger terminal → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_head_pending_sibling_succeeded_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [HEAD-SUCCEEDED-SIBLING-COMMAND-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_SUCCEEDED_SIBLING_COMMAND_PENDING_DRAIN.md); stacks #3018 / #3014; does not close #2737–#3013 Acceptance.