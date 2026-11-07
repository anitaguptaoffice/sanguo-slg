# API-RETURN-SOURCE-SQL-001

Task [#2159](https://github.com/anitaguptaoffice/sanguo-slg/issues/2159).
Tests only; no constructor, runtime route, workflow, enrollment or deployment change.
Baseline main `419fed8b5b2e36c706799909bc1eb506e0973d94`, tree
`dcb3c2a2f9e724834da0c49d853c02738eb316da`. Existing recorder originated in
[#2140](https://github.com/anitaguptaoffice/sanguo-slg/pull/2140), source
`30894219f70335c81b24d19bbfb4f2e1fc07cf03` / tree `3633101a13a2fd16d3027c847985e3826eb5f84f`.

The old recorder accepted arbitrary SELECT/WITH prefixes. A rolled-back writable
CTE can leave the observer's row snapshots unchanged. No actual constructor write
was found. Historical reviewed-source and PG evidence remains specific to that
source; the prefix check did not prove all possible future SQL side-effect-free.

The assertion now permits only 16 exact static query hashes from 17 named source
sites, the captured-schema work_queue_id_seq read, exact Begin/Rollback strings,
and the existing 12 exact ordered table pins. The frozen source/hash inventory
lives in return_source_sql_test.go; ACCOUNT/MIL headers share bytes. Return adds
returnCatalogSQL to the common constructor validation path. No trace or source
loader regenerates expected hashes. Any legitimate SQL change requires review,
updated fixed expectations and rerunning the relevant PG evidence. This is not
a general SQL parser, a query-argument validator or proof of external source trust.

TestReturnSQLRecorded invokes the actual assertion in bounded child processes,
feeding synthetic trace events only. No payload SQL is executed against a DB.
Positive controls resolve source literals and require their frozen hashes, check
the quoted captured-schema sequence and all 12 approved pins. Negative controls
cover writable CTEs, multi-statements, all four row-lock modes, allocator spelling
variants, setting writes, unknown queries, wrong schema/sequence, pin changes and
appended SQL. Child acceptance requires its exact marker and zero exit; rejection
requires exit 1, the exact test and quoted SQL diagnostic, without extra output.
Panics, unrelated failures, skips and timeouts are not valid rejection evidence.

Tests-first checkpoint `f6de010a436153b587d7e69c9a70217a2d6bc1f5` / tree
`5c731395fb777e911bcadb1757c961b943b9180a` retains the old assertion. Preserve this
same test file for official baseline/fixed witnesses. Run from repository source:
`go test -count=1 -run '^TestReturnSQLRecorded$' ./internal/api` (also `-race`).
Require a behavioral baseline failure with unsafe child acceptance, not merely
build failure, and all 46 child cases passing on the correction. Then run complete
API ordinary/race on isolated PG17 with no unintended skips and all required CI.
Local hash/scope checks are static only: Go/gofmt/PG execution, independent final
review, runtime red/green, final-head CI and post-merge verification remain pending.
