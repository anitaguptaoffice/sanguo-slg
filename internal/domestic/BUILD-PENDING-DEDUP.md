# DOM-BUILD-PENDING-DEDUP-001

Issue #2078 supersedes the withdrawn client-only experiment #2079. A waiting
or active job for the same city and slot now rejects another upgrade through
existing ErrInvalidUpgrade. No resource debit, job allocation, scheduler entry,
or state publication occurs for that rejection. A finish timestamp in the past
is not proof of completion; the job must actually leave the unfinished state.

Memory checks run under the Hub mutex. Durable checks query work_queue after
saveCityInTx acquires the player's wallet row lock and validates city ownership.
This serializes independent same-player transactions, including separate pools
and Hubs whose cached queue predates the accepted request. The query filters
server, city, build queue type, unfinished status and payload slot. Existing API
error mapping is retained; there is no protocol or schema change.

Different slots and subsequent levels after completion remain supported. This
is rejection, not request replay/idempotent success, cancellation or refund.
Pre-existing duplicates are not repaired. The existing full-snapshot persistence
model still assumes one active Hub owner per city for other writes; this change
does not establish general multi-owner queue/scheduler consistency or protect
against unrelated stale writers replacing the queue. Do not deploy multiple
owners on the strength of this focused duplicate-submission guard.

## Validation

- Unit regression: `go test ./internal/domestic -run TestBuildPending -count=1`.
- Database regression: set DATABASE_URL to an isolated test PostgreSQL instance,
  then `go test ./internal/domestic -run TestPGPendingBuild -count=1 -v`.
- Run existing domestic tests, race checks, repository unit/build/lint CI.
- The PG fixture creates and drops a private schema. Never target production.
- Missing DATABASE_URL skips the PG suite and is not acceptance. Real PG evidence,
  independent final-source review and exact-head required CI are merge gates.
