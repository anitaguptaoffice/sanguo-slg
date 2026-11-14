# first_city_ledger_pg_mapping_fence

**Non-production** isolated PostgreSQL 17 physical mapping / continuous fence fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-MAPPING-FENCE-001).

- Default fail-closed; EMPTY-initial intake requires full physical mapping row + continuous fence evidence in disposable fixtures only.
- Not wired to API, client, cmd, realm enrollment, cutover, production fence controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_mapping_fence_realm`, `harness_mapping_proposal`.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_mapping_fence/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_mapping_fence/ -count=1 -v
```

Spec harness (unchanged by this package): `go run ./spec/db/tests/first_city_ledger_mapping_fence`
