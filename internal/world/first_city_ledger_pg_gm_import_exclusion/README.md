# first_city_ledger_pg_gm_import_exclusion

**Non-production** isolated PostgreSQL 17 GM / import / batch SQL tool online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-GM-IMPORT-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `batch_worker` maintenance representative (`cmd/gm` has no city-import subcommand).
- Not wired to API handlers, client, cmd/gm, realm enrollment, cutover, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_gm_import_state`, `harness_gm_batch_hold`, GM batch and EMPTY-reopen triggers; disposable `mil_city_origin` for batch proof only.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_gm_import_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_gm_import_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_gm_import_exclusion`
