# Atomic chunk persistence

Task [WORLD-CHUNK-ATOMIC-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2174)
is new implementation from main `41b3aef34a74fb239f70d319356c7e7071cd0401`.
Only `persist.go`, `persist_chunk_atomic_test.go` and this document are in scope.
No diagnostic branch, ignored artifact or workflow is a production dependency.

## Transaction and ordering

One nonempty `SaveChunk` call owns one explicit transaction. Each supplied cell
queues the original single-row upsert, in input order. The batch is closed and
all results consumed before the sole commit. First batch errors and commit errors
are returned unchanged, without retries. Deferred rollback uses an independent
five-second context and cannot replace the primary result. This is a bounded
cleanup attempt, not proof that a disconnected backend has already ended.

Cancellation does not imply that commit failed. If commit succeeds, return nil
even when cancellation is subsequently visible. A lost commit response remains
unknown: all supplied updates or none, never an inferred success, compensation
or automatic retry. PostgreSQL transaction atomicity is the durability boundary.

[pgx v5.7.4 SendBatch](https://github.com/jackc/pgx/blob/v5.7.4/conn.go#L908)
sends queued statements together; its batch must close before connection reuse.
[BatchResults.Close](https://github.com/jackc/pgx/blob/v5.7.4/batch.go)
consumes unread results, keeps the first error and closes an unsynchronizable
connection. All queries may prepare before execution, which is safe here because
every statement uses the same existing relation and SQL shape.
[Transaction behavior](https://github.com/jackc/pgx/blob/v5.7.4/tx.go)
does not auto-rollback on context cancellation; rollback is safe after commit,
and a failed real rollback closes the connection.
[Pool transactions](https://github.com/jackc/pgx/blob/v5.7.4/pgxpool/tx.go)
release their connection on commit/rollback, including error results.

A sequential explicit transaction would also be atomic but retain one Exec round
trip per cell. The ordered batch avoids that protocol pattern with O(n) queued
arguments. This is a design rationale, not a measured speedup. A single multivalue
upsert is unsuitable: repeated conflict keys must remain sequential last-wins.
No query mode, isolation default or connection setting is changed.

`LoadChunk` now explicitly orders by y, then x, matching `GenerateChunk` and the
complete-chunk row-major indexing used by `cellAt`. Its bounds, selected columns,
COALESCE mapping and `len(out)>0` found behavior are unchanged.

## Compatibility and caller audit

- Empty/nil input is still a successful no-op without acquiring the pool, even
  with an already-canceled context. One caller-supplied shard, arbitrary existing
  coordinate inputs and sparse slices are accepted without new validation.
- Each row retains the six INSERT columns and only the original three conflict
  UPDATE columns. ResourceType zero remains SQL NULL. Input is neither reordered
  nor deduplicated, so duplicate keys retain the final supplied values.
- `Loader.Cells` caches after successful load/save; missing chunks generate as
  before. `InitServerMap`, called by runtime `PrepareGame`, still skips any found
  chunk. Only each SaveChunk call is atomic, not an entire server initialization.
- Historical partial chunks remain found and unmodified on load. This repair
  does not make sparse slices valid complete-chunk `cellAt` arrays, regenerate
  missing positions, delete data or perform a historical repair/migration.
- `RefreshWildResources` supplies loaded cells to SaveChunk. Its earlier
  `ClearResourceOccupancy` operations remain separate and are not rolled back by
  this transaction. Loader cache invalidation is unchanged.
- WORLD city/API registration fixtures save complete chunks. Modern
  `CreateCityInTx` and `FreshCityParticipant.Insert` use exact persisted coordinate
  reads and existing row locks, not Loader or pool-based SaveChunk. They retain
  caller-owned transaction lifetime and do not generate missing map rows.
- MIL/API sparse source-validation fixtures use direct coordinate/catalog paths;
  this change does not impose a complete-map requirement on them.

## Evidence and remaining gates

[Baseline run 42295087978](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42295087978)
used official Go1.23.12/PostgreSQL17.11, ordinary and race, exact old main archive.
Independently reviewed behavioral red: midway SQL failure left1250 rows and a
fresh Loader reused1250; observed cancellation left1251 after backend transaction
end; reversed heap insertion produced actual Seq Scan and wrong `cellAt` result.
Diagnostic Drafts #2165/#2168 remain NEVER MERGE. Their frozen corrected 308-line
witness belongs to a separately registered active regression card, not this card.

Focused unit tests check batch arguments/SQL, empty no-op, close-before-commit,
unchanged original errors, no retries and canceled-caller independent cleanup.
The fake transaction's successful commit after cancellation tests result handling,
not real PostgreSQL cancellation or durability.

Local source checks: whitespace and exact-path/line-budget checks only. No usable
local Go/gofmt/PostgreSQL runtime; no installation, compilation or runtime PASS
is claimed. Required official commands include ordinary/race focused tests and
`DATABASE_URL=... go test -count=1 ./internal/world ./internal/api` plus `-race`.
The unchanged frozen PG witnesses, real compatibility/complete-map cases,
same-fixture baseline/candidate performance measurement, independent exact-source
and combined review, and all applicable CI remain required before delivery.
New baseline/content requires renewed review and affected tests. No deployment.
