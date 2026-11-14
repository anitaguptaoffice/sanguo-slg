# Slot head mismatch gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-NOT-CURRENT-HEAD-DRAIN-001)

**Not** adopted. Task: [#2966](https://github.com/anitaguptaoffice/sanguo-slg/issues/2966). Stacks [#2960](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_STALE_EVIDENCE_DRAIN.md) / [#2722](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6/§8; complements [#2722](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md) companion classify (no re-run) and [#2960](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_STALE_EVIDENCE_DRAIN.md) sibling-stale drain (no re-run). Does not close #2737–#2960 Acceptance.

**Invariants:** after normal close + dual-command strict classify + rollback evidence aligned, `world_first_city_actor_slot.head_command_id` ≠ canonical head `cmdHead` blocks `declare_drained`; cleanup alone ≠ drain; slot restored → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_not_current_head_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.