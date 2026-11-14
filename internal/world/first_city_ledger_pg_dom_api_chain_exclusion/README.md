# first_city_ledger_pg_dom_api_chain_exclusion

**Non-production** isolated PostgreSQL 17 DOM/API `CreateNewCity` → `saveCityWithWorld` → `CreateCityInTx` chain online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-DOM-API-CHAIN-EXCLUSION-001).

- Default fail-closed; subprocess proof uses spec `chain_worker` through `internal/domestic` (unchanged production chain).
- Not wired to API handlers, client, cmd, realm enrollment, cutover, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_dom_api_state`, `harness_dom_chain_hold`, dom-chain and EMPTY-reopen triggers.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_dom_api_chain_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_dom_api_chain_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_dom_api_chain_exclusion`
