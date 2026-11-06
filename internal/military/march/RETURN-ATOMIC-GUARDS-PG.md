# MIL-RETURN-ATOMIC-GUARDS-PG-001

Registered card: [#2128](https://github.com/anitaguptaoffice/sanguo-slg/issues/2128).
New tests on the #2126 fixture combination `0be7d9d`; source dependency #2125 / #2127.
Only this document and `return_atomic_guards_pg_test.go` are this card's changes.
Normal-merged dependency `10bc605` includes #2126's reviewed UTC fixture correction
and its explicit MIL-only evidence limits; the shared helpers are not edited here.

## Public rejection matrix

`TestPGReturnAtomicPublicRejectedBranches` calls the actual public ports across:
Complete early, credited terminal and annihilated terminal; Readback still returning,
early, credited terminal and annihilated terminal. All seven exercise missing/extra/
unknown stock units, wrong army status/position, empty heroes and missing origin.
The five retained-survivor branches also reject missing/unknown/zero survivors and
missing/invalid deadlines. Both annihilation branches reject unexpected survivors,
an unexpected return deadline, and false zero-stack returning state.

There are 80 named negative leaf cases. Each corrupts only its own test transaction,
requires ErrReturnUnavailable and a completely zero ReturnObservation, rolls back,
then compares the full stock/graph/evidence/sequence snapshot including tuple versions.
A separately constructed observer pool cannot reuse the Owner backend after rollback;
each case logs distinct backend PIDs. No private loader substitutes for a public call.
This adds no duplicate positive admission-bypass cases already covered by #2126.

## Actual deferred outer COMMIT failure

`TestPGReturnAtomicDeferredCommitFailure` creates only an auxiliary relation in its
owned disposable schema, with DEFERRABLE INITIALLY DEFERRED UNIQUE. The unchanged
23-object profile neither includes nor depends on that relation. No certified table
gets a new constraint/trigger, and no production failure callback is introduced.

The test Owner successfully inserts a duplicate before public Complete. Complete
must yield exact provisional Applied, actual credited stock and the terminal graph
inside that transaction, while an independent observer still sees the original rows.
Actual Owner.Commit must preserve PostgreSQL 23505 with the auxiliary constraint,
table and schema identity. Independent post-commit-failure snapshots must equal the
original stock/graph/evidence/sequence and auxiliary tuple snapshots; Access is ended.
Owner's conservative ErrOutcomeUnknown wrapper is retained. This database-confirmed
rollback case is not a lost acknowledgement, interrupted process or recovery proof.

## Verification and limits

Not executed locally: official Go/gofmt and PostgreSQL are unavailable in this executor.
Required gates remain official Go 1.23.12 formatting, exact new-test inclusion, full
MARCH PostgreSQL 17 ordinary and race runs with zero skipped/failed tests, independent
final-source/combination/log review, required CI and post-merge main/push verification.
No runtime pass is claimed. Both test names above must appear in the PG gate inventory.
These fixtures prove only MIL participant and actual outer transaction behavior when
executed, not APP's closed caller graph, network uncertainty, process restart, HERO
release, production enrollment, activation, deployment or the complete return loop.
The reused helper pins only MIL; the fixture has no player_city and takes no actual
ACCOUNT/wallet/WORLD locks. It does not prove cross-domain Recruit compatibility.
