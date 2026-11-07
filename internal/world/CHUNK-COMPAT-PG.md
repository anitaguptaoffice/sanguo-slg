# Chunk PostgreSQL compatibility and performance evidence

[WORLD-CHUNK-COMPAT-PG-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2175)
owns only this document and `persist_chunk_compat_pg_test.go` (<=400 changed lines).
The local tests-first base is old main `41b3aef34a74fb239f70d319356c7e7071cd0401`.
Source candidate #2174 is `4c7480198e73fb8dbad3dfbb46e069fc62d6779f`.
Source approval/composition and exact final-head review are separate gates.
Frozen #2173 tests remain unchanged and are not helpers or dependencies here.
Diagnostic PRs #2165/#2168 remain NEVER MERGE; no artifacts/workflows are imported.

## Real PostgreSQL checks

Every fixture loads the actual `spec/db/002_world.sql` into an owned random schema,
requires PostgreSQL 17, verifies separate writer/observer backends, uses bounded
contexts, and drops only its own schema. No mock provides correctness evidence.

- Empty/nil saves succeed with canceled context. Empty load is not found. Sparse
  input, arbitrary coordinates, duplicate-coordinate last-wins, SQL NULL mapping,
  bounds and shard isolation preserve the existing contract and input slice.
- A fresh Loader retains legacy partial rows. One partial row in each chunk makes
  the real InitServerMap no-repair path testable without generating 250000 cells.
- Generated 2500-cell data is compared field-by-field through an independent SQL
  observer and real LoadChunk. The resulting complete image supports `cellAt`.
- A real BEFORE UPDATE trigger fails at update 1251. A nontransactional fixture
  sequence observes exactly 1251 attempts; snapshots require original row values,
  keys, visible ctid/xmin and unrelated tables after rollback. No retry is allowed.
- A later successful save publishes the whole new image. A fixture-only extra
  column keeps its old nondefault value; unrelated city/occupancy rows retain their
  exact JSON image. Production map_cell has only six columns; this fixture column
  is not a schema change or a claim that extra columns are generally supported.
- Real RefreshWildResources leaves its earlier occupancy clears committed when
  SaveChunk fails, while the map image rolls back. The subsequent successful
  refresh updates only eligible resources and preserves another shard.

## Audited boundaries and gaps

`chunk.go` Loader and `service.go` InitServerMap use any nonempty load as found.
Runtime PrepareGame/API integration call InitServerMap. Sparse data is not made a
valid complete `cellAt` array. No historical repair, deletion or regeneration is
added. Refresh occupancy writes and Loader cache invalidation remain separate.
Modern CreateCityInTx/FreshCityParticipant use direct coordinates and caller-owned
transactions. Full WORLD/API validates those unchanged city/source paths separately.
Concurrent first loads, competing same-shard batches, deadlocks, process death and
lost COMMIT acknowledgments are not exercised here. Cancellation does not prove
rollback; unknown commit outcome remains full-or-none, without automatic retries.

## Reproduction and evidence status

Local checks are exact scope/line-budget/whitespace inspection only. No usable
local Go/gofmt/PostgreSQL execution or installation; no compilation/runtime PASS.
The official old-code red run is [42295087978](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42295087978).
It does not execute these new tests or prove candidate success.
After approved composition, run with owned DATABASE_URL, official Go1.23.12/PG17:
`go test -json -count=1 -run '^TestPGChunkCompatibility' ./internal/world`
and the same command with `-race`, then unfiltered WORLD/API and all required CI.
Use an outer timeout and reject actual test skips/failures; retain exact refs,
source/test blobs, tool versions, raw JSON and read-only gofmt output.

For performance, materialize exact old main and exact approved new source in
separate worktrees/databases with byte-identical compatibility test file. Record
both source/tree SHAs, test SHA256, Go/PG versions and machine configuration.
Run each in alternating old/new order with the same Go1.23.12/PG17 installation:
`go test -run '^$' -bench '^BenchmarkPGChunkSave$' -benchtime=5x -count=5 -timeout=10m ./internal/world`
This reports five groups of five measured SaveChunk calls for each insert/update
case; Go may additionally calibrate with an untimed-in-report one-operation run.
The fixed generated cells and SQL warmup are identical. Per-insert TRUNCATE,
fixture setup and final exact observer comparison are outside measured duration.
Update measures re-upserts of an existing image. Each fixture has a five-minute
context and writer statement timeout; no race-instrumented timings are compared.
The atomic counters report observed pgx query, batch, batch-statement and explicit
COMMIT callbacks. They are not network round trips, server implicit-commit counts,
or a protocol trace. Warmup callbacks are reset before timing. Preserve all raw
samples; report distribution/sample count, not a selective best result.
No benchmark has run yet; timing, measured counters and any speedup are pending.
Publication/merge remain blocked on independent final composition review, official
ordinary/race regression/compatibility/full WORLD/API and required CI evidence.
No production deployment or historical hold release is authorized by this card.
