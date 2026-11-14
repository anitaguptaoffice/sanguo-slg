# first_city_ledger_pg_online_exclusion

**Non-production** isolated PostgreSQL 17 online exclusion / last-txn false-drain fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-ONLINE-EXCLUSION-001).

- Default fail-closed; intake under exclusion requires legacy hold drain + mapping/fence evidence in disposable fixtures only.
- Not wired to API, client, cmd, realm enrollment, cutover, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_online_exclusion_state`, `harness_legacy_hold`, `harness_city_queue_alloc_seq`, `harness_mapping_fence_realm`, `harness_mapping_proposal`, bypass trigger on `world_first_city_command`.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_online_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_online_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_online_exclusion`
