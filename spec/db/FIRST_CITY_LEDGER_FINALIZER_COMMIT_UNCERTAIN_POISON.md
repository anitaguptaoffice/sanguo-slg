# Finalizer commit-uncertain poison (SPEC-FIRST-CITY-LEDGER-FINALIZER-COMMIT-UNCERTAIN-POISON-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2705](https://github.com/anitaguptaoffice/sanguo-slg/issues/2705). Stacks Draft
[#2703](https://github.com/anitaguptaoffice/sanguo-slg/pull/2703) /
[#2701](FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.10 (finalizer commit ending
unknown → poison/unresolved, original-identity readback, no second guess-rejection txn); §8 (reading PENDING does
not bypass poisoned generation); [FIRST_CITY_LEDGER_PHASE_ADMISSION.md](FIRST_CITY_LEDGER_PHASE_ADMISSION.md)
(disposable gate/lease fixture only — scenarios here not re-run).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) generic poison-before-Begin linearization | Narrow **finalizer terminal UPDATE + commit-uncertain** + **no second rejection guess** |
| [#2701](FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md) inter-gap terrain flip | No terrain matrix |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) seven rollback/whitelist scenarios | Only uncertain **commit** ending on terminal path |
| [#2578](FIRST_CITY_LEDGER_ACK_LOSS.md) process restart / ACK-loss grid | Finalizer SQL commit-uncertain slice only |

Harness **`harness_source_gate` / `harness_lease`** tables are **disposable-fixture only** (same pattern as
phase admission); not production migrations. **`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Uncertain finalizer commit:** After linearized `finalizer_begin`, a terminal `UPDATE … durable_state=3` runs
   in a real transaction; when commit ending is **unknown** (harness: `ROLLBACK` after UPDATE simulates lost commit
   ACK), the writer path must **poison** admission (`admission=poisoned`, `drain=unresolved`). The command row stays
   `durable_state=1` with no committed `terminal_at` / `rejection_reason`.
2. **No second guess rejection:** While poisoned, a second linearized `finalizer_begin` plus terminal `UPDATE` must
   **not** commit; observer still sees sole `PENDING`.
3. **PENDING read, no bypass:** `SELECT` by original `command_id` may still show PENDING and unchanged
   `content_sha256`, but `try_acquire_admission` / linearized `try_record_begin` reject under poison — reading PENDING
   does not authorize a new finalizer attempt.

## Scenarios (harness minimum)

1. Terminal UPDATE then uncertain ending → poison + PENDING, no business rows.
2. Poisoned gate → second finalizer guess blocked; still PENDING.
3. Observer readback: same identity, admission still rejected.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_commit_uncertain_poison
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_commit_uncertain:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-RECEIPT-NO-SOURCE-DRAIN-001** —
[FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md)
(`first_city_ledger_finalizer_receipt_no_source_drain`). CITY_CREATION_RECOVERY §10 item 3 **remaining** after
that slice (if any), §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 — separate
SPEC cards. Concurrent terminal ordering remains [#2563](FIRST_CITY_LEDGER_RACE.md).
