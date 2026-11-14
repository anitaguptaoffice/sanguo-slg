# first_city_ledger_pg_pending_unique_index

Isolated PG17 proof for **SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001** (not production).

```bash
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
GOTOOLCHAIN=local go test -v ./internal/world/first_city_ledger_pg_pending_unique_index/
```

Frozen harness (read-only): `go run ./spec/db/tests/first_city_ledger_pending_unique_index`.
