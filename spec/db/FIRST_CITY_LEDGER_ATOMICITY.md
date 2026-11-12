# Per-barrier effect-transaction atomicity (SPEC-FIRST-CITY-LEDGER-ATOMICITY-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2581](https://github.com/anitaguptaoffice/sanguo-slg/issues/2581). Stacks
[#2580](https://github.com/anitaguptaoffice/sanguo-slg/pull/2580) /
[#2579](FIRST_CITY_LEDGER_ACK_LOSS.md).

Normative obligations: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §6
(one effect transaction for pins, wallet, WORLD INSERT+readback, MIL marker/库存, DOM checkpoint/buildings,
and SUCCEEDED receipt; failure ends the whole effect transaction; **no** rejection append after wallet/city
mutation then `COMMIT`; allocator sequence gap allowed, not a business effect) and §11 **atomicity** row
(per-barrier fault → observer sees full effect+success **or** full business rollback).

This card freezes **single-writer, single-transaction** barrier faults on disposable PG17 with independent
observer connections and readable command / wallet / CITY / MIL / DOM rows. It does **not** re-run
[#2566](FIRST_CITY_LEDGER_EFFECT_PATH.md) four concurrent terminal races, [#2580](FIRST_CITY_LEDGER_ACK_LOSS.md)
six ACK-loss/restart scenarios, INITIAL/absence/retention §11 rows, WebSocket/`cmd/server`/browser matrix,
realm drain/fence, or `internal/api/fresh_admission.go`.

| Barrier fault | After failed effect txn ends (`ROLLBACK` or fault before `COMMIT`) |
|---------------|---------------------------------------------------------------------|
| Wallet | No committed wallet row for this player; no `player_city`; `durable_state=1`; no success columns |
| WORLD INSERT/readback | No `player_city` at fixture coordinates; no success receipt |
| MIL marker + cohort inventory | No committed city missing any of `mil_city_origin` + zero `city_troop` |
| DOM checkpoint + initial building | No committed city missing `city_production_checkpoint` + initial `city_building` |
| Receipt / pre-`COMMIT` abort | All business rows above absent; `durable_state≠2`; harness also rolls back a forbidden in-txn rejection append after business staging |

City identity: harness fixture `city_id=88001` only; **`player_city_id_seq` not activated**. Disposable
`mil_city_origin` shape in harness only (not production DDL).

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_atomicity
```

Record `SHOW server_version` and each `PASS atomicity:` line. Does not certify any target realm or complete §11 product acceptance.

## Follow-on

INITIAL intake arbitration (CITY_CREATION_RECOVERY §5 / §11 INITIAL row): [SPEC-FIRST-CITY-LEDGER-INITIAL-001](FIRST_CITY_LEDGER_INITIAL.md) (`first_city_ledger_initial`).
Absence / retention/cutover / native browser — separate SPEC cards.
