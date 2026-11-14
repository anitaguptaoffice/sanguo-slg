# first_city_ledger_pg_old_binary_exclusion

**Non-production** isolated PostgreSQL 17 old-writer / prior-release rollback-binary online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-OLD-BINARY-EXCLUSION-001).

- Default fail-closed; legacy subprocess calls production `CreateCityInTx` only via spec `legacy_worker` (unchanged).
- Not wired to API, client, cmd, realm enrollment, cutover, signed rollback apply, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_old_binary_state`, `harness_legacy_hold`, legacy-writer and EMPTY-reopen triggers.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_old_binary_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_old_binary_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_old_binary_exclusion`
