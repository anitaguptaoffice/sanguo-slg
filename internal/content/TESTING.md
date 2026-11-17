# PostgreSQL fixture ownership

`openContentTestDB` returns a fixture-owned pool. With default warm reuse this
pool is shared across tests; with reuse disabled the fixture registers its own
cleanup. Callers must not close either pool. Pools created independently with
`pgxpool.NewWithConfig` remain owned by their creating test and require cleanup.

Concurrent test workers must all finish before a fatal assertion starts pool
cleanup. Keep their actual error messages and validate every result; do not hide
unexpected transaction failures as accepted rejections.
