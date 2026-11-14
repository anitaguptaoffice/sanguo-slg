# first_city_ledger_pg_retention_cutover

**Non-production** isolated PostgreSQL 17 retention / cutover fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-RETENTION-CUTOVER-001).

- Default fail-closed; writes require full `ObligationEvidence` from test session only.
- Not wired to API, client, cmd, realm enrollment, cutover, or `player_city_id_seq`.
- Disposable fixtures: `harness_retention_proposal`, `harness_retention_integrity`.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_retention_cutover/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_retention_cutover/ -count=1 -v
```

Spec harness (unchanged by this package): `go run ./spec/db/tests/first_city_ledger_retention_cutover`
