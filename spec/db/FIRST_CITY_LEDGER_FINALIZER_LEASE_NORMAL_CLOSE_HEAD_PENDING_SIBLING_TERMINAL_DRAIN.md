# Head PENDING + retained sibling terminal gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-HEAD-PENDING-SIBLING-TERMINAL-DRAIN-001)

**Not** adopted. Task: [#2984](https://github.com/anitaguptaoffice/sanguo-slg/issues/2984). Stacks [#2982](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_COMMAND_PENDING_DRAIN.md) / [#2981](https://github.com/anitaguptaoffice/sanguo-slg/issues/2981). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6/§8/§9; complements [#2972](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_COMMAND_PENDING_DRAIN.md) (sibling not in ledger) and [#2982](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_COMMAND_PENDING_DRAIN.md) (sibling PENDING). Does not close #2737–#2982 Acceptance.

**Invariants:** dual strict classify + slot/evidence aligned; head `durable_state=1` blocks `declare_drained` despite retained sibling `durable_state=3`; cleanup ≠ drain; head terminal → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_head_pending_sibling_terminal_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [HEAD-TERMINAL-SIBLING-TERMINAL-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_TERMINAL_SIBLING_TERMINAL_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_head_terminal_sibling_terminal_drain`); stacks #2991 / #2986; does not close #2737–#2986 Acceptance. Complements [HEAD-PENDING-SIBLING-SUCCEEDED-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_HEAD_PENDING_SIBLING_SUCCEEDED_DRAIN.md) (#3013 / #3008 stack).