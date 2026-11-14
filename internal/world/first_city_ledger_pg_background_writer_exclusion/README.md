# first_city_ledger_pg_background_writer_exclusion

**Non-production** isolated PostgreSQL 17 co-located background writer (queue / mail / rank / chat / isolated-domain) online exclusion fail-closed matrix (WORLD-FIRST-CITY-LEDGER-PG-BACKGROUND-WRITER-EXCLUSION-001).

- Default fail-closed; subprocess proof uses frozen spec `bg_writer_worker` representative (`queue|mail|rank|chat|isolated`; not production controller; not `player_city_id_seq`).
- Not wired to API handlers, client, cmd/, realm enrollment, cutover, production fence/drain controllers, or production domestic/mail/rank/chat store paths.
- Disposable fixtures: `harness_bg_state`, `harness_bg_hold`, `harness_bg_allocator_highwater`, `harness_isolated_catalog`, bg-bundle triggers.

```bash
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_background_writer_exclusion/ -count=1 -v
export ALLOW_OWNED_PG17_TEST=1 FIRST_CITY_LEDGER_TEST_DSN='postgres://…'
GOTOOLCHAIN=local go test ./internal/world/first_city_ledger_pg_background_writer_exclusion/ -count=1 -v
```

Spec harness (unchanged): `go run ./spec/db/tests/first_city_ledger_background_writer_exclusion`
