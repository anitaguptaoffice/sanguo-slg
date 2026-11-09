# Standalone subprocess failure isolation

Task #2231, API-RECRUIT-PROCESS-FAIL-CLOSED-001. APP test-only prerequisite on
main0bd6f2cf3238d68338f930040416d9e74e0bcfa9. No original Recruit child dependency.

recruitPanicGuardedChild calls its supplied child on the same test goroutine,
with a direct deferred nonzero exit installed before any child fixture cleanup.
Fatal and Goexit unwind to that defer before testing runs T cleanups. Panic prints
its original value and stack. Unexpected return also fails. Caller os.Exit(0)
remains unchanged and bypasses the defer. This is owned-process disposal, never
graceful pool drain, remote backend termination or unknown recovery.

TestRecruitCleanupFailureRunner is an independent actual compiled-binary consumer:
fatal, goexit, panic and return must exit1, retain diagnostics and suppress its
registered cleanup sentinel. It is runner-unit coverage, NOT Recruit PG acceptance.
The optional bounded stdin-release barrier supports isolated failure observation;
its use does not authorize database or backend cleanup.

The prerequisite must pass independent review, official ordinary/race and affected
package/CI gates on its own exact main-based head before landing. Corrected #2183
then replaces its existing direct dispatch with this runner, without removing any
assertion or increasing its400-line own patch. #2233 separately supplies actual
child injection and PG observability. #2183 must not merge until that final
combination passes real PG17/race/full-package, bootstrap, reliable DDL logging and
genuine direct-dispatch red evidence. No unsafe intermediate main is permitted.

Old direct-child-defer9852930a and harness5fc23c1 remain immutable history. Their
static approvals do not transfer to this redesign. No local Go/PG/race result is
claimed; tests-first and final head/tree mappings are recorded on the task issue.
