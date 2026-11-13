# first_city_ledger_pg_sequence_repair_exclusion

**Non-production** isolated PostgreSQL 17 standalone `nextval` / `setval` / sequence-repair online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-SEQUENCE-REPAIR-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `seq_repair_worker` representative (`city_nextval|setval|repair`, `queue_nextval|setval|repair`; not production controller; not `player_city_id_seq`).
- Not wired to API handlers, client, cmd/, realm enrollment, cutover, production fence/drain controllers, background writer, or production `city_sequence.go` / march nextval paths.
- Disposable fixtures: `harness_seq_state`, `harness_seq_hold`, `harness_seq_allocator_highwater`, `harness_city_id_seq`, `harness_queue_id_seq`, seq-bundle triggers.

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_sequence_repair_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_sequence_repair_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_sequence_repair_exclusion`
