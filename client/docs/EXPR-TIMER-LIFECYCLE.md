# Training countdown lifetime

Task: CLIENT-EXPR-TIMER-LIFECYCLE-001, issue #2215.

The training countdown belongs to a mounted, visible hero panel. Detail invalidation
(including close, return and detach) clears its interval immediately. A countdown
also stops at its next tick if another center panel hides its owner. Normal detail
reads restore the actor-owned training snapshot and start at most one interval.

Before this repair, `detach()` cleared only the largess timer. Existing
`HeroMailPanels.exprExperience.test.ts` cleanup correctly called `detach()`, but an
expression timer survived jsdom teardown and threw `window is not defined` in
CI run 42313777446 / job 128221302632 after all 3422 assertions passed.
The two implicated source blobs equal main b68bdaa and the failing CI source.

Clearing on detach alone is insufficient: an already submitted BeginExpr can
succeed later. Countdown creation requires a currently mounted, visible root;
each interval captures that root and stops when it no longer owns the display.
If the panel has been reattached and is already showing the successful receipt,
its current display still gets a working countdown and deadline controls.
This is resource ownership, not server cancellation.
Existing receipt persistence, wallet application, explicit actions and settlement
semantics are unchanged. Broader BeginExpr receipt/actor ownership is not claimed.
There is no window-existence catch or relaxed unhandled-error gate.

`HeroMailPanels.exprTimerLifecycle.test.ts` reproduces the original leak with
mounted DOM events and fake interval handles. Every case also asserts that normal
detach cleanup leaves no interval. Coverage includes immediate/repeated cleanup,
active ticking/deadline controls, close/reopen, detach/reattach, repeated detail
reads, delayed BeginExpr success (including deadline progression on a rebuilt
visible panel), delayed detail reads and successful settlement.
The original experience/settlement tests remain unchanged.

Validation: run `npm test` and `npm run build` in `client/`. Publication requires
independent final-source review, isolated same-file held #2004/#2065 combination
checks and exact-head official CI. This change adds no controls, layout or new
interaction. It does not establish browser/live-server acceptance or release
those held features. No production deployment.
