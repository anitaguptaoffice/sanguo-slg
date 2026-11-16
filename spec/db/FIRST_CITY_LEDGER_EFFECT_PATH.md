# WORLD first-city ledger full effect-path concurrency (SPEC-FIRST-CITY-LEDGER-EFFECT-PATH-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2565](https://github.com/anitaguptaoffice/sanguo-slg/issues/2565). Stacks on draft PR [#2563](https://github.com/anitaguptaoffice/sanguo-slg/pull/2563).
Extends companion [§4.1–§4.3](FIRST_CITY_LEDGER_PG_COMPANION.md) business path and [§5.3](FIRST_CITY_LEDGER_PG_COMPANION.md#53-concurrency-with-effect-spec-first-city-ledger-race-001-frozen) terminal races.

**Non-goals:** realm certification, deployment, `player_city_id_seq` activation, product/runtime writers, CITY_CREATION_RECOVERY §11 full matrix.

## Invariants (row evidence, not SQL error text)

Effect/continue and narrow rejection finalizer share the same slot/command `FOR UPDATE` + advisory serialization as [#2563](FIRST_CITY_LEDGER_RACE.md). Within one command PK:

1. **Effect wins with §4.2 path:** After `COMMIT`, committed observers see `durable_state=2`, a valid success receipt (`success_city_id` matches allocated `city_id`), and **all** companion business rows in the **same** transaction: `player_wallet` (preserve-or-insert + locked row), `player_city` at C1, `map_cell` coordinate still consistent, `mil_city_origin` marker, zero-count `city_troop` cohort row, `city_production_checkpoint`, and initial `city_building`. No dangling business without receipt and no `durable_state=2` without the full set.
2. **Finalizer wins:** After `COMMIT`, only `durable_state=3` with `rejection_reason IN (1,2)`; **no new** wallet / CITY / MIL / DOM business rows for this attempt.
3. **Opponent open:** While effect holds command `FOR UPDATE` with business SQL executed but not `COMMIT`ted, independent connections see `durable_state=1` only and **zero** committed business rows for the allocated fixture `city_id`; finalizer must not `COMMIT` an opposing terminal.
4. **Losers roll back:** A participant that loses the terminal race `ROLLBACK`s the whole transaction, including any staged §4.2 inserts—never a partial committed effect.

City identity uses harness fixture `success_city_id=88001` only; **`player_city_id_seq` is not activated**. Disposable schema may create reviewed `mil_city_origin` shape via migration SQL for harness evidence only (not ApplySpecs / production DDL).

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_effect_path
```

Core terminal race harness (command PK only): `go run ./spec/db/tests/first_city_ledger_race`.

## Follow-on (separate SPEC cards)

Slot/head intake CAS (competing INITIAL, predecessor CAS): [SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001](FIRST_CITY_LEDGER_SLOT_CAS.md) (`first_city_ledger_slot_cas`). Restricted-role ACL suites, per-barrier crash recovery, `validate_only` GUC, `player_city_id_seq` activation, CITY_CREATION_RECOVERY §10 items 3 and 5–7, target-realm drain/fence execution, and full §11 atomicity matrix beyond the four scenarios above.
