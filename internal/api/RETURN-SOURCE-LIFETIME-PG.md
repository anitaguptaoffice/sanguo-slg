# API-RETURN-SOURCE-LIFETIME-PG-001

Issue #2137 adds initialization-only evidence using #2136's owned quoted-schema
fixture and the private #2135 generation. No Complete/Readback attempt, runtime
Server wiring, production enrollment, validator relaxation or recovery API occurs.

Required ordinary AND race test names, with every named subtest executed:
- TestPGReturnGenerationOrderedPins
- TestPGReturnGenerationCanceledPin/default_unknown
- TestPGReturnGenerationCanceledPin/cancel_request_ended
- TestPGReturnGenerationClosedPoolQuarantine
- TestPGReturnGenerationConstructorPanic
- TestPGReturnGenerationRollbackFailureQuarantine

Twelve independent EXCLUSIVE blockers permit constructor reads while blocking the
expected ACCOUNT 2 / DOM 1 / WORLD 1 / MIL 8 pins. Each pg_locks observation checks
exact granted prefix, current waiting pin, absent future pin suffix and matching
pg_blocking_pids, with no map_cell creation pin. A test-only rollback gate verifies
all pins and unpublished bundle before actual end. Independent lock probes and
all-table/sequence snapshots verify release and no business mutation.

Default pgx cancellation must retain unknown after actual rollback failure. The
separate test-only CancelRequest watcher allows real server cancellation and a
confirmed rollback; this is NOT a guarantee for production connection settings.
A closed captured pool tests conservative Begin-error classification, not network
BEGIN ambiguity. A one-shot constructor QueryTracer panic must propagate unchanged
after bounded rollback. Terminating only the fixture's captured backend produces
an actual rollback error: even independently observed server end cannot clear the
retained unknown generation. No network lost-ack or process-restart claim is made.

Follow #2136's full-API PG17/official-Go ordinary and race protocol: zero skipped or
failed actual tests, every required name and tested-package PASS. Report separately
the six precisely allowlisted generated-protobuf no-test packages. Static checks do
not satisfy this gate. Combined source/fixture/lifetime review and exact-head CI are
required before source merge. This executor has not run Go or PostgreSQL.
