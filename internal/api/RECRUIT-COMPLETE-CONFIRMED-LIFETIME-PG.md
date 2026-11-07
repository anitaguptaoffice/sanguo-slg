# Confirmed completion survives lost bookkeeping

APP card API-RECRUIT-COMPLETE-CONFIRMED-LIFETIME-PG-001, issue #2260.
Base: ROWS #2259 actual ad30b7b0ca3d8f072c23d687b7a02c08f6e9563e,
tree 59c9d7044765cfbbe301770d0f97543d2a40c107. All existing files are read-only.

This closes missing real-PG acceptance, not an observed production bug. The
actual nil Commit path must preserve Completed before deferred bookkeeping,
as required by #2221 and MIL_RECRUIT_PORTS. Existing bookkeeping tests do not
prove this transaction boundary.

Both control and missing_record use two actual paid admissions and the unchanged
22-second due schedule. Actual clock End and Commit Start prove provisional
invisibility. An owner-specific, one-shot Start token binds successful Commit
End to its exact captured connection; OBSERVED receives End before the gate.
Only the real completion is armed. Isolated callback controls are not business
failure evidence and do not execute their supplied SQL.

At End, PostgreSQL has committed but APP has not returned confirmation. The
independent complete ROWS checkpoint is durable while the original attempt
still has admitted phase, zero result and one unresolved admission lease. Only
missing_record deletes that exact pointer. After release/join, both calls return
confirmed Completed. Loss retains the same full record and a separate diagnostic,
retires the generation and drains known-ended work. Control removes the record
and leaves the generation healthy. Retired copies cannot issue more SQL.

Whole snapshots preserve receipts, origins, wallet, allocators and unaffected
MVCC. Ordered trace rejects rollback/retry; actual lock release, close/drain and
two simultaneous healthy pool slots preserve the durable checkpoint. Cleanup
releases End before the starter's bounded join and retains exact-owned fallback.

Inventory: TestPGRecruitCompletionConfirmedLifetime with control/missing_record.
Both new Go files require official formatting and exact-head PG17 ordinary/race,
full API and explicit required inventory. Local Go/PG was not run; old evidence
does not validate this card. No Return, unknown/deferred Commit, cancellation,
panic/network/process/close race, FIRST/controller/recovery or activation proof.
Production remains default-disabled; whole-chain and historical holds remain.
