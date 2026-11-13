# WORLD first-city ledger `validate_only` GUC (SPEC-FIRST-CITY-LEDGER-VALIDATE-ONLY-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2682](https://github.com/anitaguptaoffice/sanguo-slg/issues/2682); stacks PR [#2681](https://github.com/anitaguptaoffice/sanguo-slg/pull/2681).
Frozen deps: `m4_010`/`m4_011`/`m4_012` (unchanged), [FIRST_CITY_LEDGER_ACL.md](FIRST_CITY_LEDGER_ACL.md).
Pattern (read-only): `hero_metadata.md` `sanguo.hero_metadata_validate_only`.

## 1. GUC

| Property | Value |
|----------|--------|
| Name | `sanguo.first_city_ledger_validate_only` |
| Scope | `SET LOCAL` only (transaction-local; not a global/session default for production) |
| Default | unset / `false` — normal intake, constraints, ACL and ApplySpecs behavior unchanged |
| Body | `m4_013_first_city_ledger_validate_only.sql` (no-op when GUC false) |

## 2. Obligations (fail-closed)

1. **Default off:** GUC unset or `false` does not enter validate-only mode; `m4_013` on ApplySpecs is a no-op.
2. **`SET LOCAL` + READ ONLY:** With `true`, the body checks `world_first_city_*` relations, frozen retention triggers, companion functions, pending unique index, and cataloged `durable_state` CHECK — `ACCESS SHARE` locks only; **no** `INSERT`/`UPDATE`/`DELETE`, **no** `CREATE`/`DROP`, **no** `GRANT`/`REVOKE`, **no** `player_city_id_seq` activation, **no** wallet / `player_city` / MIL/DOM business writes.
3. **Failure stays closed:** Missing relations, missing index/functions/triggers, wrong transaction mode, or invalid schema → exception; no durable writes and no partial enablement.
4. **Not a bypass:** `validate_only` does not waive ACL, new-intake unauthorized-until-obligations, drain/fence, enrollment, or cutover gates.

`ROLLBACK` the validate transaction; observers see unchanged ledger/business counts and sequence highwater.

## 3. Boundaries

This card does **not** certify playable first-city, target-realm authentication, deployment, live routes,
`player_city_id_seq` activation, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence execution,
runtime/API/client writers, or wire / `durable_state` shape changes.

## 4. Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_validate_only
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP` exit 0.

## 5. Follow-on (separate SPEC cards)

**SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001** frozen in [FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md](FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md) (`first_city_ledger_player_city_id_seq`). Crash barriers, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence (remainder of [FIRST_CITY_LEDGER_ACL.md](FIRST_CITY_LEDGER_ACL.md) §5 after this card).
