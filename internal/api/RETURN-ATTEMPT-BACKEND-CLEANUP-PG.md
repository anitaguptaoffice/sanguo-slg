# API-RETURN-ATTEMPT-BACKEND-CLEANUP-PG-001

Registered #2171 before edits; explicit acceptance dependency for #2170.
Base `7ff229d053bbbe115838f3eddb4839139c1d64d9`, tree `9e4966d5baea60732a22af3fd844a21802fdcb37`.
First checkpoint transfers the earlier PG source without claiming behavioral red.
Known review finding: client socket close does not guarantee PostgreSQL interrupts
pg_sleep(60). Final correction must set a finite owned-session statement bound and
verify exact backend disappearance with a fresh independent observer deadline.

All acceptance remains private: no local Go/PG, install, compile, gofmt, runtime
or race pass. Official owned PostgreSQL ordinary/race and affected lifetime,
serialization, lock-order plus full API acceptance and exact-head CI remain gates.
No production/shared-helper edits, unknown recovery, remote publication or merge.

## Correction and interpretation

The forced query connection sets statement_timeout=5s before BEGIN. A witnessed
PgSleep query is interrupted on the client by its retained transport; the caller
must join within one second after close. Two concurrent Close calls test the
idempotent capability. A fresh independent ten-second observer bound then waits
for absence of the original PID/backend_start, separately from client joining.
The server may reach the statement timeout before detecting disconnect. This
proves bounded owned teardown, not immediate server disconnect detection or a
specific network ordering. No PID-targeted destructive SQL is used.

Two newly created pool connections capture concurrently while the initialized
connection remains acquired. A real successful query exercises normal joining;
its original transport stays usable until explicit teardown. Synthetic stale
metadata closes only the retained original transport, while the same-database/user
observer sentinel survives that closure and a zero-ownership close rejection.
The original captured records remain unchanged. This is not actual PID reuse.
