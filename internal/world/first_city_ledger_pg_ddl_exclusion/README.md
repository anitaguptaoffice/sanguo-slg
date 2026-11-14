# first_city_ledger_pg_ddl_exclusion

**Non-production** isolated PostgreSQL 17 ApplySpecs / manual migration / lazy store DDL online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-DDL-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `ddl_worker` representative (`apply_specs` | `manual_migration` | `lazy_store`; not production migration controller).
- Not wired to API handlers, client, cmd/, realm enrollment, cutover, production fence/drain controllers, sequence-repair, background writer, or `player_city_id_seq`.
- Disposable fixtures: `harness_ddl_state`, `harness_ddl_hold`, `harness_ddl_owner_claim`, `harness_ddl_allocator_highwater`, DDL-bundle triggers.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_ddl_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_ddl_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_ddl_exclusion`
