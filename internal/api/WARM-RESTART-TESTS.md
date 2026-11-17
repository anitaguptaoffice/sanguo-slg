# Warm-schema restart tests

Full-spec API smoke tests use a process-wide fixture pool. A restart must
create an independent pool from that fixture's configuration, retaining its
search_path and committed rows. Do not reopen DATABASE_URL directly: its
default schema is not the fixture schema. Do not close the shared fixture
pool or reset the fixture between the two simulated server instances.

`reopenDBPool(t)` obtains the already initialized fixture for the same test
and creates a separately owned pool, registered for cleanup. Tests which
explicitly close their initial pool must also use this helper initially.

Run against a dedicated disposable PostgreSQL 17 database:

```sh
go test -count=1 ./internal/api -run 'TestSmokeDailyCalendarClockPG|TestINTG006Data002SmokePath|TestWarmRestartPoolOwnershipPG' -v
go test -race -count=1 ./internal/api -run 'TestSmokeDailyCalendarClockPG|TestINTG006Data002SmokePath|TestWarmRestartPoolOwnershipPG' -v
```

Set DATABASE_URL to that database. Missing database configuration skips these
tests and is not acceptance. The shared fixture remains available for the
next test after a restart connection closes.

Fault-injection tests that rename tables or install triggers/functions call
`isolateWalletDDL(t)` before fixture acquisition. Their subtests use disposable
schemas, because TRUNCATE cannot restore DDL. Data-only tests retain warm reuse.
This opt-out is test-local and restored automatically; do not globally disable
warm reuse merely to conceal fixture contamination.

Cross-pool boundary tests call `isolateWalletPools(t)` before acquiring fixtures.
Each fixture must own a distinct schema and pool; warm reuse would erase the
foreign-pool condition or duplicate seeded accounts. Preserve rejection assertions.
