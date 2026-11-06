# Actual Recruit confirmed lifetime evidence

Card: [API-RECRUIT-ATTEMPT-LIFETIME-PG-001 / #2193](https://github.com/anitaguptaoffice/sanguo-slg/issues/2193).
Frozen base: `36edfa30c85a6ccf926d03e0dfb072c66eeceebd`, tree
`0ad965083b025cfd9b16ac4e5e8114ab6bb7db11`. New tests only, default-off source unchanged.

Required ordinary and race inventory:
- `TestPGRecruitAttemptConfirmedLifetime`
- `TestPGRecruitAttemptConfirmedLifetime/close`
- `TestPGRecruitAttemptConfirmedLifetime/missing_record`

`close` pauses actual COMMIT at pgx TraceQueryStart, after Owner end linearization
but before SQL execution. Close rejects copied same/fresh-key admissions without
canceling the already admitted command or ending its lease. Drain stays blocked;
releasing the gate permits the original real COMMIT and full confirmed acceptance.
`missing_record` pauses the nil-error, exact COMMIT-tag TraceQueryEnd callback,
BEFORE Owner.Commit returns to APP. An independent observer proves durable success,
then the test deletes only the exact private attempt entry under its mutex. No
panic or error is substituted. Once real Commit returns nil, APP must preserve
confirmed acceptance despite its later bookkeeping diagnostic, close admission,
retain the same original record, release the ended lease and send no rollback.

Both cases use actual concrete participants, fixed paid-catalog/SQL oracles,
complete wallet/gold/job/origin/receipt comparisons, all rows and xmin/ctid,
explicit sequence last_value/log_cnt/is_called, and untouched bootstrap queue1.
Exact owned transport capture and bounded joins precede pgx CleanupDone and pool
cleanup. PID/backend_start are read-only observation, never signaling authority.

Read-only dependencies: #2163, #2167, #2187, #2190, #2170/#2171; #2153 is semantic
reference. Failure atomicity, caller serialization and transport unknown are owned
separately by #2187/#2190/#2191. This is not network-loss or panic evidence. No
unknown lease is cleared, no automatic resend, and no production hooks are added.
Precommit/commit/cleanup panic, completion, crash/restart, V2 journal, enrollment,
shared controller, writer fencing and activation remain separate gates.

Tests-first source checkpoint is intentionally unexecuted before fixture support.
No local Go/gofmt/build/PG/race result is claimed. Both new Go files need official
Go 1.23.12 formatting plus PG17 ordinary/race with zero configured-DB skips, full
affected package checks, independent exact-head/combined review and required CI.
Local source preparation does not authorize publication, main merge or deployment.
