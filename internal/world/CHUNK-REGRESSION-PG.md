# Atomic chunk and canonical load regressions

Task: [WORLD-CHUNK-REGRESSION-PG-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2173).
Source dependency: [WORLD-CHUNK-ATOMIC-001](https://github.com/anitaguptaoffice/sanguo-slg/issues/2174).
This card adds only the active regression test and this document, no production edits.
The local tests-first checkpoint uses old main `41b3aef34a74fb239f70d319356c7e7071cd0401`
and is not a publishable standalone state. Its exact commit/tree are recorded on #2173.
Independently approved source `4c7480198e73fb8dbad3dfbb46e069fc62d6779f`
(tree `f8d8474ab31bc80c83095601f9d648e67ea21c6a`) was normally combined with
reviewed tests-first `9280f7723b2fd85298a8ee040b65e3a7abb562de` as merge
`1039d140e0616c798dcda2246be97f94ffe581ee`, tree
`1a45e7722c61f4e7ed7346f54b653348df2f6f9b`; this documentation update follows.
Final composition review and exact head/tree mappings are recorded on #2173.
No repaired-source runtime execution or passing result is claimed.

## Frozen test provenance

`persist_chunk_pg_test.go` is byte-for-byte the corrected artifact from #2164,
[#2165](https://github.com/anitaguptaoffice/sanguo-slg/pull/2165)
head `e52fe0e0a1f9e18fbea6c75307301aad6ccd800b`, artifact path
`internal/world/testdata/chunk_persistence/persist_chunk_pg_test.go.txt`.
The active copy has 308 lines, 10754 bytes, Git blob
`3db887d2a3bc6c87299948d72c5dba16ddaa6bf7` and SHA256
`34c60427bf1567d72f8b12fc00be546af203fd8acb499e7a01c077609a1de58e`.
The corrected version query was officially compiled and formatted on the old baseline.
No test names, zero-atomicity expectations, transaction-end waits or ordering assertions
are changed. Do not import diagnostic ancestry, artifact, documentation or workflow.
Both diagnostic Drafts #2165 and #2168 remain NEVER MERGE.

## Verified old-code failure, not repaired-source acceptance

[Official run 42295087978](https://github.com/anitaguptaoffice/sanguo-slg/actions/runs/42295087978)
used Go 1.23.12 and PostgreSQL 17.11, exact archived old main above, and the frozen test.
[Original raw evidence](https://github.com/anitaguptaoffice/sanguo-slg/pull/2168#issuecomment-6695831261)
was independently accepted before this regression card. In each ordinary/race mode,
all three tests and the package failed with exit 1; six behavioral assertions fired:
- SQL failure left 1250 committed/loaded rows and a fresh Loader reused 1250, not 2500.
- Observed mid-save blocking exposed 1250; after cancellation and original backend
  transaction end, durable/restart counts were 1251. Client return alone proved no rollback.
- Actual traced Seq Scan returned first coordinate (149,199), not (100,150), causing
  both noncanonical row 0 and the wrong actual cellAt result.
Official formatting/stderr were empty, with no setup/compiler/race failures or skips.
Earlier run 42291835125 failed fixture setup; run 42293342687 failed its strict 1250
cancellation gate. Preserve both original failures without rewriting their conclusions.

## Required repaired-source execution

Use official Go 1.23.12 and separate owned PostgreSQL 17 ordinary/race databases.
Each test creates a random schema, applies existing 002_world.sql, uses an independent
observer and removes only owned state. Never use a shared or production database.
On the independently reviewed source/test composition, retain full JSON and exit status:

```sh
DATABASE_URL=... go test ./internal/world -run '^TestPGChunk(SaveFailureAtomicRestart|SaveCancellationAtomic|LoadCanonicalHeapOrder)$' -count=1 -timeout=3m -json
DATABASE_URL=... go test ./internal/world -run '^TestPGChunk(SaveFailureAtomicRestart|SaveCancellationAtomic|LoadCanonicalHeapOrder)$' -count=1 -timeout=3m -race -json
```

Both modes must run all three tests and PASS with no skips, failures or missing results.
Retain the zero-committed/absent-chunk/restart 2500 evidence after SQL failure, zero
visible/durable and restart 2500 after observed cancellation plus backend transaction
end, and actual sequential plan with every canonical cell and cellAt result checked.
The focused run does not replace full unfiltered WORLD ordinary/race, applicable API
startup/runtime integration, independent final review or all required CI.

## Limits and pending gates

The authoring environment did not run or install Go/PostgreSQL. Byte identity and static
checks are not a runtime PASS. The source/test combination still requires independent
exact-composition review and official execution, plus separately owned compatibility
and same-fixture performance evidence. No branch or PR is published by this worker.
These witnesses cover real SaveChunk/LoadChunk, fresh Loader restart and cellAt, not
process death, actual InitServerMap startup, full API gameplay, uncertain-commit retry
safety, occupancy-clear atomicity or Loader cache lifetime. Existing sparse/legacy
presence semantics are unchanged; no completeness validation or historical-data repair.
Do not weaken the frozen witnesses or expand this card to cover those separate gates.
No workflow/spec/schema/permissions changes, deployment or historical hold release.
