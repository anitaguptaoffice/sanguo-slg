# API-RETURN-ATTEMPT-BACKEND-CLEANUP-001

Registered #2170 before edits; corrective dependency for #2153/#2154/#2156.
Base `76ded2ceed4d7765bf28267fdfc6c821903c36f2`, tree `fc8c7c1495c79525505e57095a1186795827f777`.
Static tests-first `191ad4c7b3bc8dc09dec1b8dedbfab2608b8a225`, tree `1c6f055a0936f7166429bbf973f6fb69e2a081c6`.
The finding is missing lifetime ownership, not reproduced PID reuse.
AfterConnect self-captures PID/start once before BEGIN; raw SQL avoids tracer pollution.
Only retained net.Conn.Close is destructive. PID/start filter readonly observations.
Missing ownership fails closed; stale synthetic metadata cannot redirect closure.
Capture, caller joins and pool cleanup are bounded; missing-ownership unit evidence is retained.
The full PG regression is split into a dependent API card before exceeding 400 changed lines.
Review found raw socket close need not interrupt pg_sleep(60); the PG card must bound server statements
and observe exact backend disappearance independently. No existing approval covers that correction.
No APP unknown recovery, production change, shared-fixture edit or #2162 overlap.
Local Go/PG unavailable: no installation, compile, gofmt, runtime red or PASS claim.
Required: dependent PG evidence, official Go/owned PG ordinary/race for ownership, lifetime, duplicate serialization,
lock-order suites and full applicable API acceptance; independent final review and all CI.
No remote publication/merge, wiring or deployment. Earlier source approvals remain historical.

## Prefix-local ownership evidence (2026-11-07)

The lifetime-only tracer/scenario helpers now travel with #2153 / PR #2198.
This card retains the shared backend ownership helpers and their own consumers.
`TestReturnBackendJoinBoundaries` checks unfinished and completed caller joins.
`TestReturnBackendCloseOncePreservesError` checks concurrent exact-transport close
happens once and preserves its original error for every caller.
`TestPGReturnBackendCaptureAndCleanupIsolation` uses the real #2146 fixture:
- capture retains the original PID/start/transport and rejects replacement;
- the independent observer is never registered as an owned cleanup target;
- stale lifetime metadata does not match another transaction using the same PID;
- canceled, already-joined caller cleanup rolls back abandoned writes using an
  independent context and leaves the separate observer connection usable.
These are additional helper invariants, not substitutes for #2171's concurrent
capture, forced-query fallback and backend-disappearance PostgreSQL coverage.
Meaningful mutation targets are duplicate-capture rejection, close-once/error
preservation, join classification, backend_start filtering, and cleanup closure.
New tests and mutations have not run locally. Official Go/lint, owned PG17
ordinary/race, applicable full API and exact-prefix CI remain mandatory.
