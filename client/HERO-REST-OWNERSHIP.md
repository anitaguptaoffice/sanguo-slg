# CLIENT-HERO-REST-OWNERSHIP-001

Issue #2031. RestHero commands already submitted to the server are not canceled or automatically retried. Server ownership/idle checks remain authoritative; no backend, RPC, visual or economy change.

A request owns its actor, original hero/detail, presentation/read generation and per-hero pending identity. A result with a different hero ID is rejected. Switching to B allows B's own request; A's old success/error/finally cannot change B's detail or unlock B. Returning to pending A remains locked until settlement. An obsolete success refreshes A only if A is currently visible, using the existing ownership-guarded detail read.

Data and presentation ownership are separate: a same-actor A success can preserve A's force cache after navigation/close/detach without borrowing B metadata. Changed actor results cannot touch the hero-ID-only cache. Every successful cache write/clear advances a storage-local per-hero in-memory revision; newer observations win even for identical values in the same millisecond or a backward clock. A pending rest also notices rendered level/force/cap changes, because upgrading changes the cap without writing the force cache. Such newer state is not overwritten by the delayed rest result. The cache remains the existing bounded, advisory session cache, not a server revision or cross-account storage redesign.

Regression evidence: mounted DOM clicks with controlled delayed RPCs fail 7 tests on base main 6af693751808c9140a3ac54bf64aa4b2b15784f6. Coverage includes A/B and A/B/A, simultaneous requests, actor replacement, close/back/detach/peer panel, failure/retry, wrong IDs, cache clears/same-time identical writes, and real upgrade/rest overlap. Native browser and live backend not run; browser launch remains environment-blocked. This nonvisual ownership repair uses executable mounted-panel integration; no claim of production acceptance.

Final tests, independent review, held #2004 temporary combination and exact-head CI are recorded on the PR. #2004 retains its existing hold and unchanged head; the known detach merge conflict from #2028 must retain both hero invalidation/reset and mailReadVersion increment.

## Verified delivery

Runtime source cdb81d6c125c3514fa655541259a0fb8f7f7c20b independently reviewed with no blockers: 60 focused tests plus 17 reviewer-authored adversarial mounted-DOM cases, build/typecheck and diff checks. Complete client suite: 540 files / 3091 tests passed (`npm test -- --maxWorkers=2`, no exclusions); build passed with existing chunk-size advisory. Temporary #2004 combination (held head adc2c9e56b2e1d1134f648e3d0d6b4f22f37f6ae): 73 tests and build passed with only the existing detach conflict resolved as above. This delivery paragraph is documentation-only; source/remote-head/tree and CI mapping remain in the PR.
