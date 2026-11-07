# Real completion rows and near-capacity checkpoint

Registered APP card API-RECRUIT-COMPLETE-RETURN-ROWS-PG-001, issue #2256.
Base: OBSERVED #2253 actual da44dad528151fb0d4dde7e8b3a5631ee42ff21e,
tree104c5ccedaa16966497a9cead5ac63543878e8a8. All inherited files stay read-only.

The paired factory retains the original Binding, independently captured34/43
profiles and separate generations. This consumer makes two actual paid count2
admissions at unit1 ready M-11, wallet0/P4, then waits for PostgreSQL time to reach
the unchanged paid22-second active finish. No paid row or schedule is fabricated.

The inherited starter calls real Recruit.complete. Its actual clock End and
Commit Start gates bound processing T and expose provisional invisibility. Six
independent bounded NOWAIT transactions prove retained wallet, WORLD city and
unit1–4 stock locks. Each rolls back even after expected55P03 or other errors.
These are six row probes, not all account/marker/queue locks or a phantom fence.
The unchanged ordered promotion SQL oracle retains the source lock-order proof.

Real controls reject unlocked-as-locked, held-as-unlocked, absent targets, wrong
markers, another PostgreSQL error and an actual statement_timeout57014. Each
probe has a three-second operation/cleanup bound and150ms server statement bound;
the six-probe group has an eight-second bound. Timeout is never a lock witness.

Only after joined clean RecruitCompleted and actual COMMIT is the checkpoint
confirmed: R=M-9/P2, conserved R+P=M-7, queue100 done/101 active, actual T/T+22s.
Full snapshots and stable projections retain paid receipts/origins/payload,
accepted times, wallet, wounded, allocators and all unaffected MVCC identities.
All six probes then succeed; actual generation drain, exact-owned cleanup and
two distinct usable pool slots retain the final whole snapshot.

Root: TestPGRecruitCompletionReturnRows. No named subcases. Both new Go files
need official formatting/lint and full non-skipped PG17 ordinary/race on the new
head. Local Go/PG was not run. Old252/27/9 and #2255's482/257/65 are separate gates.

This card does not call Return.complete or implement a concurrent follower,
FIRST's full routing/partition controls, overflow rollback, unknown/lifetime,
network/recovery, shared controller, natural creation or deployment. Production
remains disabled; whole-stack and historical holds remain.
