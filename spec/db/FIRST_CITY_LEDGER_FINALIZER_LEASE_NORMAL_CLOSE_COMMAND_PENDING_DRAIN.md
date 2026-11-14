# Ledger command PENDING gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-COMMAND-PENDING-DRAIN-001)

**Not** adopted. Task: [#2971](https://github.com/anitaguptaoffice/sanguo-slg/issues/2971). Stacks [#2968](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_NOT_CURRENT_HEAD_DRAIN.md) / [#2966](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_NOT_CURRENT_HEAD_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6/§8; complements [#2968](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_NOT_CURRENT_HEAD_DRAIN.md) slot head alignment (no re-run) and harness command-ending gates (no re-run). Does not close #2737–#2968 Acceptance.

**Invariants:** after normal close + dual-command strict classify + slot/evidence aligned, any `world_first_city_command.durable_state=1` blocks `declare_drained`; cleanup alone ≠ drain; ledger terminalization → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_command_pending_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-COMMAND-PENDING-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_COMMAND_PENDING_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_command_pending_drain`); stacks #2981 / #2972; does not close #2737–#2972 Acceptance.