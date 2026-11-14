# first_city_ledger_pg_effect_path

Isolated PG17 companion §4.1–§4.3 full effect business path + §5.3 terminal concurrency (`firstcityledgerpgeffectpath`); **not production**; fail-closed by default.

```bash
# SKIP without owned disposable PG17
go test ./internal/world/first_city_ledger_pg_effect_path/ -count=1 -v

export ALLOW_OWNED_PG17_TEST=1
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_effect_path/ -count=1 -v
```

Frozen harness (read-only): `go run ./spec/db/tests/first_city_ledger_effect_path` with the same env vars.
Fixture `success_city_id=88001` only; `player_city_id_seq` not activated.
