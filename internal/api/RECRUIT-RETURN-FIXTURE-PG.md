# Safe real interoperability fixture

Card #2172 independently owns the fixture, its standalone PG test and this doc. Scenario #2169 depends on it, never the reverse.
Pure dependency base: 1ef96cd5cc6d70dcf9855706f367c04e954c43dd / tree f0920c67d18e62d552543231f31d9434f2a41621, normal b799d364 + approved ccdd2b9 merge.
Transfer reference: original 207-line fixture in 8ab480d; that original overall review remains CHANGES REQUIRED and is not silently relabeled approved.
Standalone tests-first c6c7648029819260818cf357521815512aa373bf preceded the transferred/corrected fixture. Missing-helper and unexecuted tests are not a behavioral red.
The captured schema, binding, cohort and paid catalog feed independently fixed 43/34-object profiles and distinct dormant admission owners.
Passive pre-COMMIT/post-wallet tracer gates and observed PostgreSQL wallet waits do not replace a participant, transaction or coordinator.
The fixture uses real qualified wallet/city/four-stock NOWAIT probes and bounded actual admit/complete calls, with no synthetic Recruit acceptance rows.
Cleanup cancels/releases gates, joins, closes/drains both owners and verifies independent lock release. It then simultaneously acquires both real pool slots, reads each backend identity and releases both, including partially acquired failures.
Standalone PG evidence checks two-slot usability before/after an actual confirmed admission, uncommitted-state isolation and actual lock retention/release without needing #2169 scenario code.
No old backend-termination helper is invoked; an unjoined/undrained/unusable resource is a test failure, not proof of cleanup. Original Return safety correction #2170 remains a final combination gate.
No production/helper/schema/workflow edits, runtime installation or Go/gofmt/PG/race execution. Official Go1.23.12/PG17.11 ordinary/race, independent exact-head/combination review and required CI remain pending.
Shared-controller enrollment, completion, V2 wire/journal, recovery, writer fencing, activation and natural end-to-end acceptance are not certified. No publication/merge/deployment.

## Scenario-only helper boundary (2026-11-07)

Historical Draft #2204 head `7dd669d75968c4eebcc1fcd9082f3f3087f801eb` failed [official lint](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42339830884/job/128304828312): `(*recruitReturnPG).events` and `waitWallet` were unused; this failure remains historical evidence.
Both complete method bodies now belong to scenario card #2169, at their first genuine caller in `recruit_return_interop_pg_test.go`; #2172 keeps its standalone constructor, actual-call/lock probes, tracing, cleanup and two-slot reuse evidence without a reverse dependency.
The standalone test, shared helpers, SQL, source profiles, production code and existing assertions are unchanged. No dummy caller or lint suppression replaces the missing consumer.
Local checks establish exact relocation, scope, caps and static dependencies only. Official Go/gofmt/lint, PostgreSQL ordinary/race, independent final component/combination review and required CI remain mandatory; no runtime acceptance, activation, merge or deployment is claimed.
