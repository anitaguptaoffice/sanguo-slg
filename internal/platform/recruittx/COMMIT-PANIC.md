# Owner Commit panic preservation

Task [#2147](https://github.com/anitaguptaoffice/sanguo-slg/issues/2147).
Base main `419fed8b5b2e36c706799909bc1eb506e0973d94`; existing lifetime contract
and public API are unchanged. Independent APP #2145 depends on this repair.

After end linearization, an underlying Commit panic remains the exact original
panic value even if the existing independent five-second Rollback cleanup also
panics. The deferred re-panic runs after cleanup, then owner cancellation and gate
release still run. Cleanup is attempted only once. Confirmed Commit success does
not clean up; ordinary errors retain ErrOutcomeUnknown and joined cleanup errors.
Without an original Commit panic, a cleanup panic still propagates unchanged.
No database end certainty, replay, unknown clearing or recovery is introduced.

In pgx v5.7.4, dbTx marks itself closed and pgxpool.Tx releases its slot only after
traced Exec returns. A test-only QueryTracer can panic before Commit SQL, or after
the successful COMMIT reply, then panic at Rollback start. Both leave the pool
slot acquired. An independent untraced backend observes zero visible rows and a
live transaction in the first case, and one committed row with no transaction in
the second. Neither is inferred from the cleanup attempt or ErrInactive.

The disposable PG17 fixture owns its exact backend and table. Only AFTER these
assertions, teardown disables its tracer, independently terminates that backend
with a bounded wait, closes its connection, and invokes the private raw Tx's
Rollback on that closed connection solely to release the pgxpool slot. Pool close
also has a bounded wait. This test-only release is not production recovery, is
not an Owner retry, and cannot establish that production cleanup ended anything.
No raw transaction or callback was added to the production surface.

Tests-first unit checkpoint: `86505969cf7261ef2e164ce8fa3fa0953a1efe30`.
Tests-first unit + PG checkpoint: `5134491fda34272e9c91d40e6fd8e2584b95cb5f`.
Corrected unit + PG tests-only checkpoint: `7f882a09ab06e0e3a7cf112bc0284bf14b724eec`.
Retained Access/repeated Commit may return ErrInactive or context.Canceled because
owner cancellation races admission; fresh-context Rollback still requires ErrInactive.
All tests-only checkpoints retain unchanged production. Local Go/gofmt are unavailable: no execution,
red or pass is claimed. Official Go 1.23.12 and PG17 ordinary/race with
RECRUIT_TX_TEST_DSN, independent review, required exact-head CI and main CI remain
merge gates; separate CI card #2149 owns execution. No activation or deployment.
