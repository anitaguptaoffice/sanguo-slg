# first_city_ledger_pg_new_intake_authorization

**Non-production** isolated PostgreSQL 17 new ledger intake/effect/finalizer route unauthorized-until-obligations fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-NEW-INTAKE-AUTHORIZATION-001; OID §6 row 12).

- Not production new route, not drain/fence controller, not realm cutover, not `player_city_id_seq`, not API/cmd wiring.
- Representative subprocess: `new_ledger_route_worker` (harness only).

```bash
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_new_intake_authorization/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_new_intake_authorization/ -count=1 -v
```

Frozen harness (unchanged): `go run ./spec/db/tests/first_city_ledger_new_intake_authorization`
