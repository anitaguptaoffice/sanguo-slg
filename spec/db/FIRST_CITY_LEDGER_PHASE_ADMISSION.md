# Phase admission, lease, close/poison linearization (SPEC-FIRST-CITY-LEDGER-PHASE-ADMISSION-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. Task:
[#2575](https://github.com/anitaguptaoffice/sanguo-slg/issues/2575). Stacks
[#2574](https://github.com/anitaguptaoffice/sanguo-slg/pull/2574). Depends on
[CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4–7.5, §8;
[FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §2;
[#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) (narrow finalizer rollback; unchanged here).

## Purpose

Freeze **phase admission physical gates** provable on disposable **PostgreSQL 17** with
independent connections, real transactions, and **readable row snapshots** of admission /
lease / drain state — not error codes, log tags, or local cleanup counters alone.

| Invariant | Requirement |
|-----------|-------------|
| **Generation-bound lease** | Begin (effect or finalizer) requires an active lease on the enrolled generation; acquisition atomically rejects `closing` / `closed` / `poisoned`. |
| **Lease ended** | After rollback or explicit end, lease row is `ended`; further Begin without a new admitted lease must be rejected. |
| **Normal close** | Close atomically stops **new** admission; commands that already hold a lease may finish per reviewed ending rules. Close request ≠ drain complete. |
| **Poison** | Commit/rollback ending unknown, rollback failure, or lost server connection → poison admission and `drain = unresolved`; no new Begin. |
| **Linearization** | Admission and Begin share one gate (`harness_source_gate` `FOR UPDATE` in the disposable fixture). **Forbidden:** read “not poisoned” then Begin without the gate. |
| **Cleanup vs drain** | Local cleanup / cancel on unknown transaction outcome must not flip drain to completed. |

**Non-goals:** companion §5 finalizer SQL rewrite; [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md)
rollback invariants; unknown drain full matrix; process restart / ACK-loss; online reopen;
`internal/api/fresh_admission.go`; realm certification; playable-first-city product acceptance.

## Boundaries

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) full rollback / whitelist / exact-attempt | Does not re-run those seven scenarios |
| [#2563](FIRST_CITY_LEDGER_RACE.md) effect/finalizer PK race | Admission gate only; ledger rows used only to show no stray terminal on poison+Begin loss |
| `m4_010` / production DDL | Harness tables are **disposable-fixture only** (created in test schema, not committed as migrations) |

## Scenarios (harness minimum)

1. Close wins race → new `try_acquire_admission` rejected; pre-held lease may still `record_phase` and end.
2. Poison wins race → new lease / finalizer Begin rejected; `world_first_city_command` stays `PENDING` if seeded.
3. Check-then-Begin illegal path does not commit phase; linearized path does.
4. Lease `ended` → `try_record_begin` rejected without new admission.
5. Cleanup attempt after poison → `drain` stays `unresolved`, not `drained`.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_phase_admission
```

Record actual `SHOW server_version` and per-scenario `PASS` lines.

## Follow-on

CITY_CREATION_RECOVERY §10 item 3 **remaining** after this slice: unknown drain full matrix,
process restart / ACK-loss, realm drain/fence, production admission controller — separate cards.
Concurrent effect/finalizer ordering remains [#2563](FIRST_CITY_LEDGER_RACE.md).
