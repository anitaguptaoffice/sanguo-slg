# first_city_ledger_pg_snapshot_flush_exclusion

**Non-production** isolated PostgreSQL 17 snapshot flusher / async persistence online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-SNAPSHOT-FLUSH-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `flush_worker` async-flush representative (`maybeFlushAll`/`SaveCity` production path not wired here).
- Not wired to API handlers, client, cmd/, realm enrollment, cutover, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_snapshot_flush_state`, `harness_snapshot_flush_hold`, snapshot-flush and EMPTY-reopen triggers (no `mil_city_origin`; flush writes `player_wallet` + `player_city` only).

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_snapshot_flush_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_snapshot_flush_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_snapshot_flush_exclusion`
