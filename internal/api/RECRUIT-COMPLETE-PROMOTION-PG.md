# Real atomic oldest Recruit promotion

API-RECRUIT-COMPLETE-PROMOTION-PG-001 / #2235, APP only. Frozen base HISTORY
#2232 head `22d77d104a451c1e5e96f891a4a8965a0cdfe2eb`, tree
`77deea0a705c194c9731e1845e5c16b5ed7ad6d7`. Three new paths; all old helpers,
source, contracts and CI remain read-only. Every new helper is consumed here.

`TestPGRecruitCompletionPromotesOldest` calls actual g.admit three times, paying
unit1/count1 costs2/3/5/7 per receipt and leaving wallet/gold zero. Independent
reads verify complete immutable receipt/candidate, origin/payload/catalog/digest,
initial statuses and max(admission time,pending finish) schedules. Ready=M-3 and
pending3, M=2147483647. Actual PG time makes active100 naturally due after11s;
no paid queue insertion, substituted clock or persisted-time rewrite.

Actual g.complete must credit one, mark100 done and promote only oldest101.
Ready=M-2/pending2 preserves R+P=M. Younger102 retains its entire live row,
MVCC and original estimates; every receipt/origin/wallet/marker/allocator and
unrelated row is unchanged. The stable projection excludes only exact target
status/schedule/count updates; full snapshots and exact final rows check effects.

The real post-clock gate bounds canonical processing T between two independent
PG samples. They are bounds, not a claim to have read the private production
sample. An observation-only tracer copies the six promotion Exec arguments;
after caller join, exact identity, canonical T, stored11s finish and committed
schedule must agree. Production's one clock and direct plan/apply wiring remain
subject to exact source review. The tracer never supplies time or business data.

At actual pre-Commit no result returns and the full independent snapshot is
unchanged. After nil Commit only clean Confirmed Completed may appear. Exact SQL
order ends clock/credit/done/promote/commit. Frozen-byte/schema/backend/order/proof
and argument negatives reject extra writes, wrong targets and wrong timing.
Generation stays open; caller join, drain and lock release are checked.

Official Go1.23.12 formatting/compile/lint, non-skipped PG17 ordinary/race, final
CI and dependency acceptance remain pending. No local Go run or installation.
This does not expand #2229. Unproven: rollback/failure, corrupt successor,
promoted/younger replay, second completion, serialization/lifetime/unknown/network/
process, completion-versus-Return and natural fresh creation. No production
activation, scanner/recovery, deployment or historical hold release.
