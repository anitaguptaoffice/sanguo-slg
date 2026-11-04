# CLIENT-HERO-POINT-OWNERSHIP-001

Issue #2033. AddHeroPoint and ClearHeroPoint now share a per-hero, actor-owned pending identity. Switching heroes does not move an in-flight request's feedback or release another request. Both actions require a loaded matching detail. Commands already submitted are never canceled or automatically retried.

Successful validated replies preserve the original actor/hero's point snapshot before checking presentation ownership. GetHeroDetail omits adds/remaining, so navigation or an intervening read is not a reason to discard an authoritative allocation/reset receipt. Cached entries carry actor validity on read and write; actor replacement cannot reuse another actor's snapshot. Hidden/detached presentation stays untouched while a valid receipt survives for a later reopen.

M1 response-budget inference is explicit: internal/hero/points.go uses PointBudget(level)=level and remaining=budget−all adds. A response snapshot therefore uses remaining+all adds as its reconciliation level, never the currently displayed or captured old level. This does not change visible hero level. Invalid negative/noninteger counters are rejected. A stale same-hero presentation or response-budget mismatch triggers an owned detail reread after saving the receipt, retaining it even if the reread fails. Confirmed visible point results advance presentation generation so older upgrade/rest callbacks reread rather than overwrite the new allocation's attributes.

This preserves observed receipts, not cross-client/server serialization: the protocol contains no revision and backend concurrency is out of scope. No wallet/bag delta, protocol, backend or other mutation implementation is changed.

Regression-first: seven mounted-DOM scenarios failed against main c6805c7e95e2bd22be9f58e225ae96f24130b230. Tests cover original snapshots after A/B navigation, actor replacement, shared add/clear lock, A/B/A, old finally, close/back/detach/peer panel, failure/ID mismatch/retry, and both point/upgrade completion orders without phantom spent points. Native browser/live backend not run; DOM integration is not production acceptance. Exact final validation and CI mapping are recorded in the PR. Held #2004 remains unchanged and requires temporary combination verification; its existing detach conflict retains hero cleanup and mailReadVersion increment.

## Verified delivery

Runtime source b4c0ba573f49e6256bda98e0c9449e66e86468d1 received independent PASS with 79 focused and 19 additional reviewer-authored DOM tests plus build/typecheck. Complete client suite: 541 files / 3111 tests passed (`npm test -- --maxWorkers=2`, no exclusions); build passed with the existing chunk-size advisory. Temporary #2004 exact held-head combination passed 92 tests and build with its pre-existing detach conflict resolved as described above. Final source/remote/tree and required CI are mapped in the PR; this paragraph changes documentation only.
