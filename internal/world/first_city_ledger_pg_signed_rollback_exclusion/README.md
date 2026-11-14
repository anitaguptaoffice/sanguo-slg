# first_city_ledger_pg_signed_rollback_exclusion

**Non-production** isolated PostgreSQL 17 signed / deployable rollback-artifact apply subprocess online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-SIGNED-ROLLBACK-EXCLUSION-001; OID §6 row 11).

- Not production signed rollback, not drain/fence controller, not realm cutover, not `player_city_id_seq`, not API/cmd wiring.
- Representative subprocess: `signed_rollback_apply_worker` + `harness_test_rollback_manifest.json` (harness only).

```bash
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_signed_rollback_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_signed_rollback_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_signed_rollback_exclusion`
