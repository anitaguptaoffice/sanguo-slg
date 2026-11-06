# API-RETURN-ATTEMPT-LOCK-ORDER-PG-001

Task [#2156](https://github.com/anitaguptaoffice/sanguo-slg/issues/2156).
New APP-only evidence against source/fixture #2145/#2146 at
`53848e0897f61edb69e20f292b8010716dfab804`, tree
`8d3e7c86dc1939ac0dda1163b9090f05bb75aba7`.
Tests-first checkpoint: `202b7b9d56541660939c70df832a2d63088381f0`, tree
`39f0c741db1523e73b2f19f165dc0a894213cd39`. No production source edits.

The actual private `complete` executes once per case, after real initialization.
Due and retained credited-terminal paths traverse twelve independently blocked
relation pins: ACCOUNT account/player ROW SHARE, wallet ROW EXCLUSIVE, WORLD city
ROW SHARE, then eight MIL ROW EXCLUSIVE pins in the frozen contract order.
At every PostgreSQL wait, pg_locks establishes granted prefix/absent suffix,
pg_blocking_pids identifies the independent blocker, and frozen SQL shows no business
row access. Source validation's exact sequence last_value read is metadata only.
A test-only pgx pre-dispatch gate at the first unlocked AccountHint SELECT permits
installing row blockers after all relation pins, without changing any participant.

Holding all five row blockers proves the unlocked hint passes the player row lock,
then account FOR SHARE precedes player FOR SHARE, wallet, WORLD origin and the first
MIL marker FOR UPDATE. Independent NOWAIT probes prove earlier locks are retained;
frozen query prefixes reject later row SQL, and snapshots show no early effects.
A player/account reassignment after the hint forces locked recheck rejection before
wallet, one bounded rollback and zero confirmed outcome, writes or replay.
Final independent snapshots preserve every untouched row/sequence; due credit and
terminal state are checked explicitly. Cleanup releases blockers/cancels/gate first,
joins the caller, permits a bounded independent abort only of its observed backend,
then verifies server lock/transaction release and pool return before fixture cleanup.
Polling schedules observations; elapsed time is never evidence of serialization.

This is APP ordering through the MIL entry boundary, not duplicate serialization
(#2154), Recruit compatibility, recovery/readback or MIL algorithm reimplementation.
The separate authority for MIL marker, all stock, all pending, march, army and all
troop lock ordering is `TestPGReturnLockedOrder` in
`internal/military/march/return_locked_pg_test.go` and its accepted domain evidence.
Annihilation/error branches beyond reassigned actor remain separate coverage gates.

Prepared locally, not executed: local `go` is unrelated. No compile, gofmt, PG PASS
or behavioral-red claim. Official Go1.23.12/owned PG17.11 ordinary and race execution
with zero unexpected skips, exact independent review, all required CI and full final
dependency validation remain required. Focused selector:
`go test ./internal/api -run '^TestPGReturnAttempt(PinAndActorOrder|RejectsReassignedHint)$' -count=1 -v`
Repeat with `-race` in the official environment; broader applicable suites still run.
PLATFORM #2147/#2150 remains an explicit prerequisite until merged and verified.
No production wiring, publication, deployment or historical hold release is claimed.
