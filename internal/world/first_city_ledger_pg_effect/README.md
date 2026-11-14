Isolated PG17 **PENDING→success effect** (`firstcityledgerpgeffect`); not production. No realm certification, deployment, `player_city_id_seq`, finalizer, or API wiring.

`ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN=… go test ./internal/world/first_city_ledger_pg_effect/ -count=1 -v`

Harness uses fixture `city_id=88001`; `mil_city_origin` is created in tests only (same pattern as `spec/db/tests/first_city_ledger_effect_path`).
