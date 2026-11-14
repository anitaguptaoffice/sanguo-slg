# first_city_ledger_pg_slot_cas

Isolated PG17 slot/head intake CAS concurrency matrix (`firstcityledgerpgslotcas`); **not production**; fail-closed by default. Intake only (PENDING + head); `player_city_id_seq` not activated.

```bash
# SKIP without owned disposable PG17
go test ./internal/world/first_city_ledger_pg_slot_cas/ -count=1 -v

export ALLOW_OWNED_PG17_TEST=1
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_slot_cas/ -count=1 -v
```

Frozen harness (read-only): `go run ./spec/db/tests/first_city_ledger_slot_cas` with the same env vars.
