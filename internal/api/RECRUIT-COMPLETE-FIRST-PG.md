# Completion-leading Return capacity

Card #2400 adds one actual concurrent success scenario, not the four-case FIRST matrix.
Its pure SOURCE/main dependency is local freeze `92aeee59`, tree `d46befba`;
no VERIFY parent, runtime activation, production controller or historical hold changes.

`TestPGRecruitCompletionFirstReturnCapacity` uses unchanged paid ROWS helpers:
real admissions create jobs 100/101, P4, zero wallet and R=M−11, then naturally wait 22 seconds.
Actual Recruit completion holds pre-Commit while the distinct actual Return backend waits
on the exact wallet SQL, proven with `pg_blocking_pids`, captured transport and trace identity.
After Recruit commits, Return pauses at successful wallet End and exposes R=M−9/P2.
Return's real pre-Commit is still invisible; confirmed Return ends at R=M−2/P2, total M.
Both closed SQL oracles, typed credit operands, COMMIT tags, stable/MVCC snapshots,
terminal no-credit replay, generation drain, lock release and two-slot reuse are mandatory.

The pre-pool router binds a transaction's connection to one immutable trace stream.
Fresh-context rollback retains that connection owner. No router mutex spans a callback/gate.
`TestRecruitCompletionFirstRouting` controls reject missing, duplicate, foreign and wrong-
connection Ends plus unknown/mismatched roles, while checking original contexts/errors.
Outstanding Start tokens must drain to zero; the omitted-End control cannot pass that check.
Opaque callback controls are not PostgreSQL evidence. Both asynchronous callers register
cancellation, gate release, bounded joins and exact-owned transport cleanup before starting.

The return candidate is synthetic fixture state; no natural creation, march, arrival,
restart recovery, opposite ordering, overflow or unknown-Commit result is claimed.
Existing separate dormant generations do not establish shared production-controller safety.
Official exact-combination full PG17 ordinary/race, both new Go formatting paths and all
inherited SOURCE gates remain pending; neither old #2263 nor main PASS transfers here.
The local environment has no usable Go compiler or PostgreSQL runtime.
