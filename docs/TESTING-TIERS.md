# Local and CI test tiers

Problem this addresses: many packages call `db.ApplySpecs` on a **new** schema or on **`public` without reset**, so a single `go test ./...` repeats minutes of DDL. That is a **policy and fixture** problem, not “buy faster hardware”.

## Tier model (what runs when)

| Tier | Local entry | Postgres | Typical time | Purpose |
|------|-------------|----------|--------------|---------|
| **T0** | `make test-fast` | No (`-short`) | tens of seconds | Edit loop: unit + mem + skipped PG |
| **T1** | `make test-gate` | Warm schema + domain suites | ~1–5 min | Pre-merge for touched domains |
| **T2** | `make test-full` / `ci:full` | Full `internal/api` PG | tens of minutes | Large API changes, release confidence |
| **T3** | GitHub `push main` | Full matrix + browser/spec harness | CI wall clock | Release gate |

**Rule:** daily work stays on **T0**. Only move up when the diff touches PG contracts, migrations, or cross-package integration.

## PostgreSQL fixture policy (canonical)

### Warm shared schema (default on)

- Schema name: `sanguo_api_fixture_v1` (fixed; not per-PID).
- Env: `SANGUO_PG_REUSE_SPEC=1` (default in Makefile). Set `0` only to debug isolation with disposable schemas.
- **First** consumer in a process: `CREATE SCHEMA IF NOT EXISTS` + `ApplySpecs` if `schema_migrations` count low.
- **Every** test: `TRUNCATE` business tables (keep `schema_migrations`), serialized with `pg_advisory_lock`.
- Pool `search_path`: `<schema>,pg_catalog` (never `pg_catalog` alone as default connection path for DDL).
- PG tests that share this schema: run with **`go test -p 1`** for that package or use Makefile targets that enforce it.

Implemented today: `internal/platform/db/pgfixture.WarmPool`; `internal/api` `walletBoundaryPool(t, true)` and `api_test.openWarmSpecDB` delegate to it.

### Not in ApplySpecs (one-time warm extras)

- MIL recruit + `mil_city_origin` on warm schema: `EnsureFirstCityPreparedMilDDL` (pgx; first call per schema; `make test-pg-warm-mil` optional prefetch).
- PreparedCity PG: `make test-fc-prepared-pg` (installs MIL if missing, then smoke).

### Anti-patterns (do not add new tests like this)

1. `ApplySpecs` on **`public`** without exclusive reset — poisons dev DB and races with `make dev`.
2. New random schema per test (`api_wallet_<nanos>`) when reuse is enabled — multiplies DDL cost.
3. `go test ./...` without `-short` during iteration.
4. `go test -p 16` combined with **shared** schema tests in the same package.
5. `exec psql` inside every test case — bootstrap targets / warm steps only.

## `-short` convention

Every test that needs **full spec DDL** or **owned disposable DB** must start with:

```go
if testing.Short() {
    t.Skip("…")
}
```

Or use a shared helper `pgfixture.RequireFull(t)` (planned; see migration).

**T0** (`make test-fast`) must remain green without `DATABASE_URL`.

## Package inventory (migration backlog)

| Area | Pattern today | Target |
|------|----------------|--------|
| `internal/api` | `walletBoundaryPool` + warm reuse (partial) | All full-spec tests via shared pool; intg/smoke use warm + seed helpers |
| `internal/api` `integration_test`, `intg*`, `gm_service`, `m3_smoke` | `ApplySpecs` per test on raw `DATABASE_URL` | Refactor to warm pool + truncate; or gate behind `-short` only |
| `internal/quest`, `chat`, `rank`, `shop`, `guild`, `content`, `hero` `*_pg_*` | **`pg_fixture_test.go` → `pgfixture.OpenFullSpecDB`** (done) | Keep new PG tests on this entrypoint |
| `internal/domestic` | `domesticWorkPool` + warm-aware `applyDomesticSchema` (done) | Queue restart / separate DB harnesses stay isolated |
| `internal/account`, `military/report` | **`pg_fixture_test.go` → `OpenFullSpecDB`** (done) | PG cases skip under `-short` |
| `internal/world`, `military` (elsewhere) | Partial SQL / owned disposable PG | Warm or isolated harness per test file |
| `spec/db/tests/*` | Own disposable PG17 | Unchanged; not part of `go test ./...` fast path |
| `client/qa/*.browser.mjs` | CI workflow only | Not in `make test-fast` |

## Phased migration (do not big-bang)

1. **Policy frozen** (this doc + `Makefile` + `CI-PR-SCOPE.md`) — done in tree.
2. **Extract `internal/platform/db/pgfixture`** — **done**: `WarmPool(t)`, `SpecDir()`, `ReuseEnabled()`, `SkipFullSpecUnderShort`. Migrate remaining domain `*_pg_*` opportunistically.
3. **api package sweep** — point `integration_test` / `intg*` / `shop_wallet_test` at warm pool; ensure all call `testing.Short()` skip or reuse.
4. **Domain store tests** — `quest`, `content`, etc.: either warm pool or `-short` skip until touched.
5. **CI alignment** — `test-gate` runs warm env vars; document that PR CI does not re-run every intg smoke.

## What developers run

```bash
# Default
make test-fast

# Touched api / domestic / world
make test-gate

# First city PG only (hot schema)
make test-fc-pg

# Optional PreparedCity (after once: make test-pg-warm-mil)
make test-fc-prepared-pg

# Heavy API
make test-full
```

## Success criteria

- `make test-fast` completes in **&lt; 2 minutes** on a typical dev machine without Postgres.
- `make test-fc-pg` **&lt; 5 seconds** after schema is warm.
- No new test files call `ApplySpecs` without going through shared fixture or explicit skip under `-short`.
- One document (this file) is the source of truth; CI-PR-SCOPE links here for local gates.