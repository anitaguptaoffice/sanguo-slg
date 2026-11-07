# Actual Recruit Early and Waiting on PostgreSQL

API-RECRUIT-COMPLETE-NOEFFECT-PG-001 / #2227. Base is actual basic Draft #2226
head `2ced90f794d16f75a7e3c14fcc23da18ab692ba3`, tree
`b384c5f1ab9879f7e9d370270b58afdf6a03310c`. Only these new APP tests/document
change; all source, existing fixtures and basic witnesses remain untouched.

`TestPGRecruitCompletionEarlyAndWaiting` invokes real paid admission twice:
unit4/count1 becomes active with its production44-second schedule; unit1/count1
becomes a paid waiter. The independently read candidate and immutable receipt,
origin, payload, wallet, marker, all stock/wounded and allocator are checked.
The exact paid resources leave all wallet fields zero. No paid queue or clock
is fabricated; no persisted schedule is edited.

Each actual complete call pauses after its real clock query has returned its
sample, before MIL proceeds. For Early the independent PG observer must still
be strictly before the active finish at this boundary. Production retains that
already-scanned canonical T, so subsequent CI delay does not change the decision.
A missed boundary explicitly fails and cancellation precedes gate release and
bounded join; it is never relaxed to Completed, fixed by time edits, or skipped.
Waiting follows the actual locked pending state, not an estimate-based guess.

At each actual pre-Commit gate no business result has returned and full durable
snapshots remain unchanged. After nil Commit only the expected confirmed Early
or Waiting may return; admission acceptance stays zero. Exact SQL order contains
all concrete pins/actor/wallet/current-city/pending/evidence/clock steps and one
Commit, with no credit/done/promotion/debit/allocation. Whole-table snapshots
include xmin/ctid and explicit last_value/log_cnt/is_called for every allocator.
The generation remains open for the second call and then closes/drains cleanly.

`TestRecruitCompletionNoeffectSQLWitness` supplies checker controls. Every new
helper is consumed in this prefix. Ordinary and race runs must use owned PG17
and execute the actual PG root without skips. Official Go1.23.12 formatting,
compile/lint, runtime and required CI remain pending; static review is not a run.

No claim for overdue waiting, clock reversal, history/replay, promotion, rejection,
rollback/failure/unknown/lifetime/network/process, completion-versus-Return or
natural fresh creation. No production activation, scanner, recovery or hold release.
