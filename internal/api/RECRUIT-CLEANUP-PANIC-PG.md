# API-RECRUIT-CLEANUP-PANIC-PG-001

Registered [#2162](https://github.com/anitaguptaoffice/sanguo-slg/issues/2162),
claimed before edits. Only this document and recruit_cleanup_panic_process_pg_test.go
are in scope. Local only, no publication. Initial dependency 816933b6, tree 8b8faf19;
adopted copied-Access base ccbd09ec212f7e5be5ddc5efe0df7370cd735002,
tree 34364fe2bf652658eb7ed930d48e7a91053ab3db. Static tests-first checkpoint
d09bf1581e61f396b7a829f436622e10a6102d93, tree 96c1d0f98fafa45c336c0723654a3eb1c4b1ccb1,
is NOT behavioral red. Prior f84bb41 / rejected 493069ad remain rejected provenance.
Candidate 6beef98d is superseded: a backend_start predicate followed by a PID-only
signal is NOT atomic identity binding. Its earlier safety claim is withdrawn.

Required cases: TestPGRecruitGenerationConstructorCleanupPanic and
TestRecruitPanicAbsenceRejectsInvalidIdentity, official Go 1.23 / owned PG17 with
host psql, ordinary AND race, zero unintended skips/failures. The child runs only
this compiled test binary and anchored PG case, preserving race instrumentation.
The pure negative case rejects zero/missing PID/start before any database action.
Actual 34-object Recruit profile and concrete constructor execute; no Return
generation initializes. Constructor-start primary panic then Rollback-start cleanup
panic retain exact primary/diagnostics, closed/no-bundle/no-retry and unknown lease.
Live transaction, acquired slot, unchanged row/xmin/ctid and allocator
last_value/log_cnt/is_called snapshots are asserted BEFORE teardown.

Initial PID/start is captured once before BEGIN and never resampled. It is used
ONLY for observation. Normal teardown closes the held trace.conn transport, joins
bounded CleanupDone, verifies immutable-identity absence and unchanged snapshots,
and checks independent lock acquisition. There are no historical-PID signals.
Raw Close, server end and process disposal never imply wrapper release or drain.

Public proof follows pgx 5.7.4 / puddle 2.2.2: Acquire takes a semaphore permit
BEFORE checking closed. MaxConns=2 leaves spare capacity beside the retained slot.
Prewarm/release spare; start Close; release every successful bounded probe at once.
ONLY ErrClosedPool proves closed state. Track every AfterConnect connection, join
spare CleanupDone without concurrent raw Close, verify exact server absence, then
assert retained slot and nonreturned Close. Only spare empty-SQL Pings bypass the
generation trace; participant SQL remains on the frozen allowlist.

Parent requires a strict ownership stream, complete witness and clean child exit
without failure/skip/race output, plus independent backend/schema absence. Failure
cleanup first requires its child reaped and all emitted identities absent; only
then may it drop the owned schema. Missing ownership or unverifiable absence fails
explicitly as cleanup-unverified without guessed kill targets or schema cleanup.
No official Go/gofmt/build, PG17, race or CI ran here. Final head/tree are recorded
on the issue. Independent component/combination review, applicable packages and
required CI remain gates; wire lost-ack, business coordination, activation and
deployment are separate. No production hooks/private wrappers/reflection/unsafe.
