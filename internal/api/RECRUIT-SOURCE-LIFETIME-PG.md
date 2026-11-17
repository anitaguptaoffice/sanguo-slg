# API-RECRUIT-SOURCE-LIFETIME-PG-001

Task [#2158](https://github.com/anitaguptaoffice/sanguo-slg/issues/2158), source
[#2155](https://github.com/anitaguptaoffice/sanguo-slg/issues/2155), basic fixture
[#2157](https://github.com/anitaguptaoffice/sanguo-slg/issues/2157). Initialization
only; actual `newRecruitGeneration`/`initialize`, never a Return generation.

Required ordinary AND race cases, with zero unintended skipped/failed tests:
- TestPGRecruitGenerationOrderedPins
- TestPGRecruitGenerationCanceledPin/default_unknown
- TestPGRecruitGenerationCanceledPin/cancel_request_ended
- TestPGRecruitGenerationBeginFailureQuarantine
- TestPGRecruitGenerationConstructorPanic/confirmed_cleanup
- TestPGRecruitGenerationConstructorPanic/failed_cleanup
- TestPGRecruitGenerationRollbackBoundary/close_during_validation
- TestPGRecruitGenerationRollbackBoundary/rollback_failure

Nine independent EXCLUSIVE blockers permit constructor reads while proving the
ACCOUNT2/DOM1/WORLD1/MIL5 pin prefix, waiting relation, absent suffix and matching
blocking PID. The witness inspects all schema relation locks except AccessShare,
so an unexpected Return/map-cell pin or wrong lock strength is not hidden. All
successful SQL uses the basic fixture's closed read/pin allowlist. A rollback gate
proves pending work and no partial bundle before actual end; copied-source close
prevents late publication and cannot erase pending work. All failure cases compare
independent snapshots of every business row/xmin/ctid and explicit allocator
last_value/log_cnt/is_called. Independent lock probes verify server release.

Default cancellation must retain unknown after actual rollback error; the separate
fixture-only CancelRequest mode requires confirmed bounded rollback and drain.
Constructor panic identity survives either successful or actually failed cleanup;
its primary diagnostic and cleanup error are checked separately. Termination only
targets the captured owned pool backend. BeforeConnect rejection proves conservative
classification after real Binding.Begin invocation, not a wire-level lost BEGIN
acknowledgment. External server end never clears retained unknown or permits retry.
Bounded initializer cleanup precedes owned connection Close/CleanupDone and pool.Close.

Tests-first checkpoint is static only. This executor ran no Go formatting/build,
PG or race test. Exact-source/combined independent review, official Go/PG17 normal
and race, complete applicable package checks, required final-head CI and main/push
verification remain gates, including PLATFORM #2147/#2150 serial-main integration.
Combined cleanup panic, direct copied-Access lifetime and network lost-ack evidence
are not inferred from these tests. Shared generation control, real wire/journal,
business coordination, writer interoperability and deployment remain later gates.
