# Process restart and ACK-loss matrix (SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. Task:
[#2579](https://github.com/anitaguptaoffice/sanguo-slg/issues/2579). Stacks
[#2578](https://github.com/anitaguptaoffice/sanguo-slg/pull/2578) /
[#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md). Depends on
[CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §8, §11; [#2578](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md).

Freeze **PG17 persistent-layer** restart and **COMMIT ack-loss** with independent
connections, real transactions, and readable command / receipt / business rows — not
WebSocket, error codes alone, or mocks.

| Invariant | Requirement |
|-----------|-------------|
| Durable intake restart | PENDING committed before effect; new connection reads same ID/payload; no wallet/CITY/MIL/DOM; no city sequence at intake (`player_city_id_seq` not activated). |
| Pre-commit disconnect | No durable row or partial terminal columns before `COMMIT`; rollback/error ≠ committed. |
| Intake ack loss | Same PENDING identity on re-read; no second command/city `INSERT`. |
| Effect ack loss | One `durable_state=2` + one city; observer retry must not double-write. |
| Finalizer ack loss | `durable_state=3` + `rejection_reason=1`, no city, stable on re-read. |
| Competitor ack loss | After terminal success, loser retry must not emit second terminal or city. |

**Non-goals:** [#2578](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) drain matrix; [#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md); [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md); WebSocket/browser §11; `fresh_admission.go`; realm certification / deploy / `player_city_id_seq`.

## Scenarios

1. PENDING intake committed, session ended → re-read ID/payload, zero business rows.
2. Pre-commit disconnect → no row; next commit creates one intake.
3. Intake commit ack loss → one row; duplicate PK blocked.
4. Effect commit ack loss → observer one success; retry blocked.
5. Finalizer reject ack loss → still reject, no city; competitor no double success.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_ack_loss
```

Record `SHOW server_version` and each `PASS ack_loss:` line.

## Follow-on

Per-barrier effect-transaction atomicity: [SPEC-FIRST-CITY-LEDGER-ATOMICITY-001](FIRST_CITY_LEDGER_ATOMICITY.md) (`first_city_ledger_atomicity`).
Realm drain/fence, production admission, CITY_CREATION_RECOVERY §10 items 5–7, full §11 browser — separate cards.
