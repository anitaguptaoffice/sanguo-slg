# API-RETURN-ATTEMPT-FAILURES-PG-001

Task [#2152](https://github.com/anitaguptaoffice/sanguo-slg/issues/2152).
New APP-only evidence, based on #2145 source and #2146 concrete fixture at
`53848e0897f61edb69e20f292b8010716dfab804` (tree
`8d3e7c86dc1939ac0dda1163b9090f05bb75aba7`). Tests-first checkpoint:
`b2c8cafcf97b49278e325e19cda4e1e3eb2b5ff3`. No production source is changed.

- Actual deferred COMMIT failure: a test-only auxiliary table outside the captured
  43-object inventory has an INITIALLY DEFERRED UNIQUE constraint. A one-shot query
  tracer first observes all provisional credit/terminal writes on the actual attempt
  connection, then inserts duplicate auxiliary rows before the real COMMIT. It holds
  no trace mutex during nested SQL and never substitutes a transaction or result.
  Exact SQLSTATE 23505, schema/table/constraint and COMMIT trace error are required.
  The observer sees complete rollback, but the caller keeps UNKNOWN and ErrInactive
  cleanup separately. A closed local owner is not a server-outcome certificate.
- Cancellation before admission performs no SQL/cleanup and leaves generation ready.
  Cancellation during wallet pin uses an independent EXCLUSIVE blocker, pg_locks
  prefix/suffix evidence and pg_blocking_pids, not sleep-based inference. Default
  connection cancellation has failed rollback/UNKNOWN; explicit CancelRequest has
  an actual successful independent bounded rollback/known-ended. Neither commits.
- Capacity rejection followed by termination of only the live test-owned attempt
  backend demonstrates failed rollback. Its original MIL cause, cleanup error,
  candidate, generation and phase remain separate. Server termination and unchanged
  observer snapshots still do not clear the caller's retained UNKNOWN.

All cases inspect independent connections and complete row/sequence snapshots.
Unknown admission remains counted through bounded drain, repeated close and rejected
alias admission/initialization; no recovery or retry is implemented. Shared fixture
cleanup is bounded, including pool Close. A configured DB error is never skipped.

Local Go tooling is unavailable: no compile, gofmt, runtime PASS or behavioral red
is claimed. Official Go1.23.12/owned PG17.11 ordinary and race, zero unexpected skips,
independent exact-head and dependency-combination review, and required CI remain gates.
PLATFORM #2147 / Draft #2150 and initialization #2142 remain explicit prerequisites.
This card does not cover every provisional-write fault, network acknowledgement loss
(#2148), process death/restart, ordered row locks, Recruit concurrency or recovery.
No production wiring, deployment, activation, spec changes or historical hold release.
