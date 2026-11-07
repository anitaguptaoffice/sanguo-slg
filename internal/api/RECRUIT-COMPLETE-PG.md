# Actual paid Recruit completion: first PostgreSQL witness

Card API-RECRUIT-COMPLETE-BASIC-PG-001, issue #2223, APP only. Original source
`b5c14218133ceaac12f260e5a7af98bb05a6a53e`, tree
`d047052ef09146793e0299e028b4da946be3618f`, depends on #2221 and cleanup #2219.
No production route, scanner, participant, SQL implementation or shared fixture changes.

`TestPGRecruitCompletionPaidDue` uses the mature owned PG17 fixture and its
independent 34-object profile. Actual `g.admit` pays 2/3/5/7 resources, leaving
all wallet fields zero, and creates unit1/count1 with the real 11-second schedule.
The candidate and full immutable acceptance come from independent durable reads.
Only actual PG clock progression makes it due; no paid queue insertion, clock
replacement or persisted-time rewrite. The source-bound catalog is test-only.

An observation-only trace pauses the actual final Commit. Before release the
independent database snapshot is unchanged and no result has returned. After
nil Commit the real APP result is Completed, with no admission acceptance.
Credit transfers pending1 to ready2147483647 from ready2147483646, conserving
representable liability. Terminal state, all four stock/wounded values, zero
wallet, marker, origin, immutable receipt/payload/schedule, unrelated row physical
identities and all allocator states are checked. Generation close/drain and
lock release are also checked; this is not a full lifetime/failure matrix.

`TestRecruitCompletionSQLWitness` and the PG trace checker use frozen exact SQL
bytes with qualifier round-trip and prescribed stage/backend order, reusing the
read-only admission classifier for common statements. Unknown/suffixed/wrong-
schema SQL, observer reuse and incomplete traces are rejected. No runtime or
test-time source-derived allowlist. Every helper is used by this prefix.

Official Go1.23.12 formatting/lint/compile, PG17 ordinary/race and required exact-
head CI remain pending; local static inspection is not runtime proof. Missing
DATABASE_URL retains the existing fixture skip, which cannot count as acceptance.
The inherited upstream formatting failure must be corrected before publication.

Unproven here: early/waiting/promotion, done/history/admission replay, rejection,
failure rollback, actor changes, serialization, cancellation/panic/unknown/network,
process checkpoints, actual completion-versus-Return, shared controller and full
natural fresh creation. Existing admission-versus-Return evidence does not prove
these. Default disabled, no activation/deployment or historical hold release.
