# APP return rollback panic

Card #3068 closes the APP coverage gap in #2192/#2198. The owned PG17 fixture
executes the real initialized `returnGeneration.complete`, participants and Owner.
Only pgx tracing injects faults; no transaction result or participant is mocked.

Two cases exercise a real capacity rejection followed by rollback panic, and a
military clock-query panic followed by rollback panic. The original failure and
both panic identities are retained separately. The original panic takes priority;
otherwise the cleanup panic is rethrown. The result remains unknown, its original
attempt and lease remain retained, admission closes, and no observation publishes.

The test observes the independent bounded rollback context, original backend and
live transaction, unchanged snapshots, exact owned transport cleanup and released
database locks. The pgxpool slot remains quarantined even after transport close;
the test requires that observation instead of claiming recovery. Each case runs
in a bounded child process; the parent reaps it and drops its emitted fixture
schema. Fatal/panic paths exit before inherited T cleanup could wait on that slot.
Unknown bookkeeping remains retained after physical cleanup. This does not prove
production activation, restart recovery, pool recovery or unknown resolution.

Run `go test -count=1 -run '^TestPGReturnAttemptRollbackPanic$' ./internal/api`
with DATABASE_URL pointing at an owned PG17 instance, also with `-race`.
Independent exact-source review and full combined API regression are required.
