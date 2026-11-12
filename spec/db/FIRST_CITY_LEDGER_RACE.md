# WORLD first-city ledger effect/finalizer race (SPEC-FIRST-CITY-LEDGER-RACE-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2562](https://github.com/anitaguptaoffice/sanguo-slg/issues/2562). Baseline: PR [#2561](https://github.com/anitaguptaoffice/sanguo-slg/pull/2561).
Depends on [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5.3 and
[FIRST_CITY_LEDGER_LOADER.md](FIRST_CITY_LEDGER_LOADER.md).

## Purpose

Freeze **core concurrent invariants** between effect success and narrow rejection finalizer on one command PK;
prove on disposable **PostgreSQL 17** with independent connections (row evidence, not error text alone).

**Non-goals:** realm certification, deployment, `player_city_id_seq` activation, full wallet/MIL/DOM effect path.

## Scenarios

Effect first → sole `durable_state=2`; finalizer first → sole `durable_state=3`; opponent holds `FOR UPDATE` →
spy sees `1` until effect `COMMIT`.

## Acceptance

```bash
export FIRST_CITY_LEDGER_TEST_DSN='postgres://.../DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_race
```

Fixture `success_city_id=88001` only. `./spec/db/validate.sh` for syntax compose.

## Follow-on

Full effect business path (wallet/MIL/DOM) races: [SPEC-FIRST-CITY-LEDGER-EFFECT-PATH-001](FIRST_CITY_LEDGER_EFFECT_PATH.md)
(`spec/db/tests/first_city_ledger_effect_path`). Slot/head intake CAS: [FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md).
ACL suites, drain/fence — separate SPEC cards.
