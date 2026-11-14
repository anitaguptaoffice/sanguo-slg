# first_city_ledger_pg_slot_isolation

Isolated PG17 cross-actor slot isolation (SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001). Intake only; not production.

Reuses `first_city_ledger_pg_slot_cas` intake semantics read-only. Validates frozen harness in `spec/db/tests/first_city_ledger_slot_isolation`.

```bash
export ALLOW_OWNED_PG17_TEST=1
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
GOTOOLCHAIN=local go test -v ./internal/world/first_city_ledger_pg_slot_isolation/
```
