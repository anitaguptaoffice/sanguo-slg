# Recruit attempt end extraction

API-RECRUIT-ATTEMPT-END-001, issue #2218. Behavior-preserving prerequisite,
not a new completion coordinator, activation or repaired behavioral regression.

`admit` still recovers directly in its deferred closure, then calls the concrete
`recruitAttempt.end`. The helper retains the original order: annotate original
panic; decide retirement from the cause; skip cleanup for confirmed success;
otherwise run `rollbackRecruitValidation`, classify known-ended or unknown;
call unchanged `finish`; propagate original panic ahead of cleanup panic.
The five-second independent rollback context, registry, lease, admission result
and transaction call graph are unchanged. No retry, callback runner, new record
fields, SQL, completion entry or caller is introduced.

The unit matrix exercises nil/zero concrete owners, cause classification,
Commit-phase panic versus phase alone, confirmed cleanup bypass, preserved
acceptance, missing registry/lease diagnostics, exact identity/retention and
unknown drain. A separate pure propagation test covers both observed panic
values. These tests do not simulate a successful database rollback or Commit.
Existing actual admission, failure, lifetime, network and panic PostgreSQL tests
remain the required evidence for real cleanup and transaction behavior.

Local static checks are not Go execution. Official formatting/build/lint, all
applicable API tests, PostgreSQL ordinary/race, required CI and independent
exact-head review remain mandatory. The real Recruit completion/Return gate in
#1950, #2145 and #2163 is still open; no scanner, recovery, enrollment, shared
controller, deployment or historical hold is released by this extraction.
