# WORLD first-city ledger slot / head CAS concurrency (SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2567](https://github.com/anitaguptaoffice/sanguo-slg/issues/2567). Stacks on draft PR [#2566](https://github.com/anitaguptaoffice/sanguo-slg/pull/2566).

Depends on [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4, [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §3 intake,
[GLOBAL_PINS](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §3–§4.3. **Intake only** (PENDING + head); no wallet/CITY/MIL/DOM; `player_city_id_seq` not activated.

## Invariants (row evidence, not SQL error text)

Companion §3 / LEDGER §4 in one transaction: advisory lock → slot create-if-absent → `FOR UPDATE` → INSERT PENDING → CAS head.

1. **Competing INITIAL on empty slot:** At most one commit with `durable_state=1` and matching `head_command_id`; loser rolls back; no orphan head or dangling PENDING.
2. **Two `command_id` values, same predecessor (NULL EMPTY):** At most one head advance; loser **HEAD_CONFLICT** (no durable mutation).
3. **Stale predecessor:** Head at command A blocks intake that assumes EMPTY or non-A predecessor.
4. **No transient EMPTY:** Mid-intake slot `FOR UPDATE` prevents a peer from committing a second INITIAL until the holder commits or rolls back.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_slot_cas
```

## Follow-on (separate SPEC cards)

**SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001** frozen in [FIRST_CITY_LEDGER_SLOT_ISOLATION.md](FIRST_CITY_LEDGER_SLOT_ISOLATION.md) (`first_city_ledger_slot_isolation`). Full `ID_CONTENT_CONFLICT` path, optional one-PENDING-per-slot partial unique index, ACL, crash barriers, `validate_only` GUC, `player_city_id_seq` activation, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence.
