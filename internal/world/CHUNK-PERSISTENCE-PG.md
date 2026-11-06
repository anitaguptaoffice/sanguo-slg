# Chunk persistence diagnostic artifact: NEVER MERGE

Task: [WORLD-CHUNK-PERSISTENCE-PG-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2164).
DIAGNOSTIC ONLY / NEVER MERGE, even if ordinary CI is green. No production repair.
Tests-first base: `41b3aef34a74fb239f70d319356c7e7071cd0401`.
Original checkpoint: `7c81811b02e65ba1e03af53fd743f0b370fa5d1c`,
tree `5f4c1fb3375a881db3e04c96be2819af4fe499f3`.
Original failed artifact: blob `1aa6c2fd0a8844fa8f0afc27b411a0eae6fcac96`,
SHA256 `ef0d63891afc0ba0e5823884d5f23caac23314f06224f0c4430e8c9149a16a37`.
Corrected 308-line artifact: blob `3db887d2a3bc6c87299948d72c5dba16ddaa6bf7`,
SHA256 `34c60427bf1567d72f8b12fc00be546af203fd8acb499e7a01c077609a1de58e`.
Only version SQL changed from SHOW text to `SELECT current_setting('server_version_num')::int`.
All test names, behavioral assertions, transaction-end checks and query-plan evidence
are unchanged. Original published checkpoint `0d5fd7a7d2a5cbf6b3f6d11a78d08f6f1ff4af4e`
remains in history; corrections are forward-only.
It is stored as `testdata/chunk_persistence/persist_chunk_pg_test.go.txt`, outside
normal Go package tests. Do not activate it on this diagnostic branch. Runtime
reproduction is pending; normal WORLD CI does not execute this ignored artifact.

## Temporary-runner PostgreSQL 17 execution

A separately registered CI-only card owns execution, without changing existing gates.
Archive the exact base above into a fresh RUNNER_TEMP directory, verify production
blobs against that base, then copy only the frozen artifact to the temporary
`internal/world/persist_chunk_pg_test.go`. Verify its hash before and after copying.
Use official Go 1.23.12, read-only gofmt checks and separate disposable PostgreSQL 17
ordinary/race databases. Never use a production/shared application database.
Each test creates a random schema, applies existing `002_world.sql`, uses a separate
observer connection and removes only its owned schema. No DDL contract changes.

Run inside that temporary old-source tree, retaining JSON logs and nonzero exit status:

```sh
DATABASE_URL=... go test ./internal/world -run '^TestPGChunk' -count=1 -timeout=3m -json
DATABASE_URL=... go test ./internal/world -run '^TestPGChunk' -count=1 -timeout=3m -race -json
```

Both modes must genuinely execute and report all three named tests FAIL with their
specific partial-save/restart, canceled partial-save/restart and noncanonical-row/
wrong-cell assertions. Also require the observed halfway lock and sequential query
plan logs. Compile errors, skips, unrelated failures, missing tests, or a green
baseline do not establish the intended reproduction. Preserve PostgreSQL/Go versions,
backend IDs, actual plans, logs, original production hashes and immutable tree IDs.
[Original diagnostic run 42291835125](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42291835125)
verified Go1.23.12/PG17.11, compilation, formatting and archived source integrity.
All three fixtures stopped at version setup because SHOW returned text OID25, which
cannot scan into int. No intended behavioral assertion was reached in either mode.
This is a fixture failure, not bug reproduction. Corrected execution remains pending;
local authoring has no usable Go/PG runtime and claims no local runtime PASS.

## Evidence and limits

- Valid generated input reaches a real trigger error halfway through insertion.
  An independent connection counts committed rows; a fresh Loader exercises restart.
- Cancellation follows an observed PostgreSQL advisory-lock wait halfway through the
  same generated input. After client return the blocker is released and the observer
  waits for the original backend to disappear or become idle outside a transaction.
  It records committed state only then; a fresh Loader also exercises restart.
- Reversed CopyFrom heap insertion plus supported sequential-scan controls exercises
  actual LoadChunk. EXPLAIN uses its traced SQL/arguments; actual cellAt is checked.
  No mock result ordering or production planner change. This covers Loader/legacy
  CreateCity, not modern direct-coordinate creation or actual InitServerMap startup.
- SaveChunk also serves resource refresh. Occupancy clearing and Loader cache lifetime
  are separate existing operations, not made atomic by a chunk-save repair.
- Existing sparse map rows support direct-coordinate MIL/API tests. This task changes
  no partial/present semantics, regenerates no rows and repairs no historical data.
- Compatibility still needs complete and legacy-partial maps, exact NULL/upsert and
  duplicate-coordinate behavior, shard/source boundaries, empty input, old-state
  rollback and actual commit failure/uncertainty. Do not infer safe retries from errors.
- Measure performance on the same PG17 fixture and inputs; record elapsed distributions,
  SQL statements, round trips and transaction commits separately. No speedup is claimed.

After actual behavioral red evidence, register production repair separately, review
its final source and validate unchanged witnesses plus full WORLD ordinary/race,
applicable API startup suites and all required CI. This artifact Draft and its
separate diagnostic CI Draft remain NEVER MERGE. No production deployment, gate/
security changes, military-worktree changes or historical hold changes are authorized.
