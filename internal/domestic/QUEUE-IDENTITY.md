# DOM persistent build identity

Prerequisite: reviewed `spec/rules/queue_identity.md` and its owner-run migration.
This consumer does not run DDL, migrate, reseed, adopt a foreign allocator, or
activate military queues. A supplied pool is bound at UseStore to schema, role,
queue/sequence OIDs and shard. Only **new persisted build admission** requires the
binding; missing allocator does not break reads, wallet refresh, snapshots, or
completion of retained jobs. Startup binding failure remains fenced until a new
store is deliberately wired after maintenance. Each allocation rechecks catalog
metadata and runtime resolution through the actual transaction. Runtime roles
may use explicitly granted access; queue/sequence ownership must match the
approved application-schema ownership (including default public's owner alias).

The new build path supplies an allocator only to a transaction-local function.
It never stores callbacks/transactions in CityState. The ID is reserved after
upgrade/resource validation and before debit/job persistence. Response, persisted
job, cache and scheduler all use that ID, and only publish after commit. Rollback
may leave a harmless sequence gap; exhaustion or missing/foreign/wrong metadata
fails closed without a fallback local ID. Memory-only upgrades retain their
per-city counter. Costs, duration, pending-row filters and FIFO are unchanged.

`SaveCity` is a snapshot/restore port, **not** new persistent job admission. It
preserves supplied IDs. Its caller must establish that jobs are already allocated
or included in the approved retained-identity inventory before restoring them.
Do not use memory-built cities as implicit new-job imports. Load, flush, completion
and restart do not allocate or rewrite IDs. Out-of-band test/import fixtures must
run the approved forward-only maintenance contract with their retained highwater;
merely assigning a high fixture ID does not reserve it in the sequence.

## Cutover gates (not performed by this code)

Stop admission and fence/drain every old build allocator, snapshot writer and
scheduled callback for this database/schema; stop concurrent maintenance/DDL.
Inventory surviving rows, memory jobs and actionable references; retire stale
sessions explicitly. Run the reviewed owner migration with retained highwater,
verify the intended runtime role/schema, then start only upgraded writers. These
steps require separate authorization; old binaries cannot be fenced by a new
library. Never run old/new allocators concurrently. The local test fixture has no
old producer and all test pools are stopped before its database is removed.

This change does **not** coordinate same-city caches across Hub instances, repair
old unknown-commit publication, infer deleted historical IDs, or make an uncertain
commit safe to retry. Existing callers must reconcile uncertain outcomes; do not
allocate another identity blindly. Physical crash/power-loss testing and live
cutover are outside these local regression tests.

## Regression coverage

`TestPGQueueConcurrentPoolsCitiesPlayersAndShards` exercises eight independent
pools/Hubs, eight cities, three players and two shards with concurrent admission;
response/cache/SQL identity and scheduler FIFO completion must agree.
`TestPGQueueRetainedJobsFlushRestartAndEmptyNonreuse` imports existing active,
terminal and foreign-type rows, honestly inventories an external reservation via
the approved fixture migration, then checks flush/reload, resumed completion and
fresh-pool allocation after the pending build queue empties. It is a process-level
Hub/pool restart test, not a physical database restart or live migration proof.

Failure tests check SQL/deferred-commit rollback and cancellation before/after
reservation, with no wallet/cache/queue/scheduler publication and allowed gaps.
The safe-integer maximum is emitted once; later admission fails while retained
completion and reads still work. A deliberately un-inventoried fixture collision
is rejected without ID rewriting, then repaired only by explicit fixture
maintenance. Metadata tests cover missing/misconfigured allocators, changed
pool/shard/OID, source metadata, temporary relation/catalog spoofing, and granted
non-owner runtime roles (including revoked sequence USAGE and foreign ownership).

`internal/domestic/queue_identity_pg_test.sh` runs race tests and vet in a new
TCP-only disposable PostgreSQL (fsync on, 1 MB WAL segments, bounded 64/32 MB WAL),
using explicit `/tmp/sanguo-toolchain/{go,pg}/bin` tools and the shared Go cache.
It additionally runs `TestPGQueuePhysicalRestart` in prepare/resume processes
separated by a clean physical PostgreSQL restart: IDs 1/2 resume and ID 3 is next.
The script stops/removes only its own fixture in the same execution lifecycle.
Normal `go test` skips that explicitly opted-in two-phase physical test; it does
not treat absence of the harness as successful physical-restart coverage.

The `pg_database_owner` alias is permitted only as default-public **schema** owner,
never as queue/sequence object owner or custom-schema ownership substitute.
Invalid initial nonnil-store wiring (nil pool or nonpositive shard) also records a
startup fence: fixing fields on that same store does not silently rebind it.
