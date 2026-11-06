# API-RETURN-ATTEMPT-LIFETIME-PG-001

Task [#2153](https://github.com/anitaguptaoffice/sanguo-slg/issues/2153).
Private tests-first evidence on #2145/#2146 source, default off. Explicit prerequisite
[#2147](https://github.com/anitaguptaoffice/sanguo-slg/issues/2147) / Draft #2150 owns
PLATFORM panic preservation; this card does not copy that fix or publish its base.

Real QueryTracer gates pause after all six provisional writes, before COMMIT, or
after a successful COMMIT command tag. An independent observer checks transaction
activity and complete business snapshots before releasing the panic/cleanup gate.
Precommit panic has confirmed independent rollback and known-ended bookkeeping.
COMMIT-start/end panic retains exact unknown identity even after successful cleanup;
the end-panic case sees full committed credit, never calls that network-loss proof.
Two concurrent start-panics use different actor/wallet/city rows and backend PIDs,
reach both gates before release, and preserve two pointer identities/pending leases.

Close rejects later admission but does not cancel an admitted successful commit.
Deleting the private attempt record at successful COMMIT TraceQueryEnd is targeted
test-only diagnostic corruption, not ordinary production reachability. Nil Commit
still confirms the exact observation, with a retained diagnostic record, closed
generation, zero pending, no rollback and complete observer effects. No reopening,
unknown resolution, recovery, production caller, TLS/auth change or deployment.

Tests require owned disposable PG17 and psql using inherited exact fixture setup.
Normal assertions verify actual rollback ends and independent server lock release;
bounded fallback teardown targets only observed fixture PIDs with live transactions.
Local go is not Go: no compilation, gofmt, runtime or behavioral-red pass claimed.
Official Go/PG17 ordinary and race, full applicable API runs, independent exact-head
and dependency-combination review, and required CI remain mandatory before release.
