# first_city_ledger_pg_id_content_conflict

Isolated PG17 proof for **SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001** (not production).

```bash
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
GOTOOLCHAIN=local go test -v ./internal/world/first_city_ledger_pg_id_content_conflict/
```

Frozen harness (read-only): `go run ./spec/db/tests/first_city_ledger_id_content_conflict`.
