# first_city_ledger_pg_restore_job_exclusion

**Non-production** isolated PostgreSQL 17 backup restore / retention job online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-RESTORE-JOB-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `restore_job_worker` representative (no cmd/tools production restore/retention job; not march `*_restore*`).
- Not wired to API handlers, client, cmd/, realm enrollment, cutover, production fence/drain controllers, or `player_city_id_seq`.
- Disposable fixtures: `harness_restore_job_state`, `harness_restore_job_hold`, `harness_restore_allocator_highwater`, restore-bundle triggers (ledger delete / allocator rollback / first-city bundle guard).

```bash
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_restore_job_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=go1.23.4 go test ./internal/world/first_city_ledger_pg_restore_job_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_restore_job_exclusion`
