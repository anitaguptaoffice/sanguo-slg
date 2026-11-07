# Completed Recruit history and original admission replay

API-RECRUIT-COMPLETE-HISTORY-PG-001 / #2230, APP only. Frozen base is corrected
NOEFFECT #2228 head `259ddf2dbbcb2999e26932f2e2de9e5da86eaa55`, tree
`08678b02472f95d5533bea10fff246c99a6b0357`, including corrected BASIC #2226.
Three new test/document paths only; all existing helpers/source remain read-only.

`TestPGRecruitCompletionHistoryAndReplay` pays through actual g.admit, observes
all immutable receipt/candidate fields, legal zero wallet and independent ledger,
then waits for PostgreSQL time to reach the real paid 11-second finish. Actual
g.complete must confirm Completed with exact terminal/stock credit and preserved
non-target values/MVCC/allocators. No paid queue insertion or timestamp rewrite.

Seven named cases cover completion, then AlreadyDone and original-key admission
replay with unchanged current state, changed city owner, and separately restored
owner but removed current marker/all stock rows. These are fixture interventions,
not supported ownership/readiness writers. Account/actor remain valid and retained
paid queue/origin/receipt stay intact. Historical success comes from actual
CompletionHint/DoneHistory or admission History, never guessed from absence.

Every call gates its actual Commit. Before release no result returns and the
independent full snapshot is unchanged; after nil Commit only clean confirmed
expected disposition/original immutable acceptance may return. Historical calls
preserve all table values, xmin/ctid and explicit allocator state. The generation
stays open across calls, every caller joins, then close/drain and locks are checked.

`TestRecruitCompletionHistorySQLWitness` freezes the two DoneHistory query bytes.
Exact stages retain all relation pins and Actor/wallet checks, then queue/receipt
history locks, with no current WORLD/stock business operation or clock. Classifier,
backend, metadata, unknown/suffix/schema, missing/duplicate/order/write and distinct
port-proof controls reject broader paths. All new helpers are consumed here.

Official Go1.23.12 formatting/compile/lint, non-skipped PG17 ordinary/race, required
exact-head CI and combined dependency acceptance remain pending. No local Go run
or installation. Earlier proof-oracle failures remain failed; new source review
cannot replace complete fresh runtime. This card does not extend #2225 CI.

Unproven here: corrupt/missing retained history, actor revocation, concurrent
serialization, promotion, failure/rollback/unknown/lifetime/network/process,
completion-versus-Return and natural fresh creation. Production remains disabled;
no scanner, recovery, deployment or historical hold release.
