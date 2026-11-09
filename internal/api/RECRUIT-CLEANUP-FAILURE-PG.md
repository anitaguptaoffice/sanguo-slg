# Recruit failure process PostgreSQL evidence

Task #2233 depends on correction #2231. Base 906f2b6b80faca7131becd74282761b1af82d741,
tree d54cb3d459c2ba045e87bf8078bef153b398b0a2. Original #2183 stays blocked.
This component adds real-child streaming barriers and independent backend observation.

TestPGRecruitCleanupFailureProcess runs original_fatal, original_goexit,
original_panic, spare_fatal and raw-close_fatal. All inherit the actual constructor
panic assertions. The parent observes immutable identities while the child waits,
releases/reaps the owned child, verifies every identity absent, then drops only the
validated emitted schema. No historical-PID signal or guessed schema cleanup.

RECRUIT_FAILURE_EVENT JSON and SQL literal RECRUIT_FAILURE_SQL carry Case, Stage,
Database, Observer (exact PID/Start), Owned, Barrier, Live, SchemaLive and ExitCode.
Stages are barrier-observed, reaped-backends-absent and case-end. All markers and
parent DROP use the same independent observer session. Live/SchemaLive retain the
pre-reap observation; ExitCode changes from -1 to the actual reaped exit status.
CI must bind same-session log order, not rounded server-log timestamps.

The general full suite does NOT invoke post-schema/pre-ownership bootstrap failure.
Separate mandatory ordinary/race CI invokes the same actual child with
SANGUO_RECRUIT_CLEANUP_FAILURE=bootstrap:fatal in an explicitly CI-owned disposable
DB. It must prove nonzero reap, absent ownership, no guessed schema DDL and complete
statement capture. Service disposal after child/client cleanup bounds that case;
an arbitrary DATABASE_URL does not authorize database deletion.

The unmerged baseline-red patch replaces guarded dispatch with the original
direct recruitCleanupPanicChild(t) call. original_fatal must expose cleanup barrier, actual admin DROP
attempt and live original backend, then reap safely. No diagnostic branch merges.
Positive server SELECT/DROP controls, complete flushed logs, ordinary/race, original
success case, full API, exact-head independent review and required CI remain gates.
No local runtime execution or reproduced PG deletion is claimed by this source.
