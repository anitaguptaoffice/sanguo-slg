# Confirm restore ending before publication

`MIL-RESTORE-END-001` (#2433) fixes the dormant read-only restore boundary.
The public port previously installed Hub state before an ignored, unbounded
rollback. A failed ending could report success; a rollback panic could also
strand the pgxpool transaction wrapper's acquired connection.

A private snapshot helper now owns a pooled connection directly, validates the
same REPEATABLE READ / READ ONLY snapshot, rolls back exactly once with an
independent five-second deadline, and releases pooled ownership before returning.
Outer Restore installs the validated plan only after that helper succeeds.
Rollback errors, including ErrTxClosed, fail closed. Read errors retain cleanup
errors; an original read panic survives a second rollback panic. Cleanup-only
panic propagates. Non-idle or closed connections are discarded by pool release.
That asynchronous disposal is not a certificate resolving unknown server work.

The real-PG suite gates rollback and checks no Hub publication before ending.
Nine cases exercise success, real query failure, read/rollback cancellation,
owned-backend termination, deadline expiry and read/rollback/double panic.
Before teardown, it checks exact transaction counts, bounded cleanup, no acquired
pool handle, independent server/lock observations, all source rows including
xmin/ctid, and all three allocators including log_cnt. Release tracing separates pending pool disposal from a leaked handle. Failure
containment closes only unreleased test-owned connections after the caller joins;
released connections remain exclusively owned by the pool destructor. Bounded
pool-close waiting cannot make the preceding ownership assertions pass. Local compilation is not PG acceptance.

No route, startup readiness, admission, automatic retry/repair, unknown clearing,
held source or production deployment is enabled. Existing full March PG17
ordinary/race CI, independent source/raw review and every required check must
pass without skipped database tests before a normal merge and main/push review.
