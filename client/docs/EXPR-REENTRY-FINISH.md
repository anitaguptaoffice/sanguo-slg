# Explicit training reward recovery after re-entry

CLIENT-EXPR-REENTRY-FINISH-001 / issue #2266. Client-only new implementation.

GetHeroDetailResponse and ListPlayerHeroes do not supply training status or deadline.
The old per-panel actor-scoped snapshot disappears on reload, so a persisted training
could not be completed through the UI. Missing data now means unknown, not idle.
“领取已到期历练” explicitly invokes existing FinishHeroExpr for the selected hero;
only the authenticated server checks ownership, session and due time. No auto-send,
reconnect retry, invented timer, new RPC, charge or reward rule. A known future
end time still blocks Finish. Unknown-state Cancel/Faster stay disabled.

The three exact server rejections have distinct guidance. Other command failures,
including timeout or a mismatched receipt, have an unknown outcome: EXP might have
been saved. No rollback, idempotence, exactly-once or safe-retry guarantee is made.
Any later click is a new explicit request; users are warned against repeated submits.
Refreshing EXP alone cannot settle an earlier request's outcome. A matching success
is retained if subsequent rendering or detail refresh fails, without resending Finish.
Existing actor/hero/view ownership, single-flight and EXP-to-upgrade rules remain.

Regression coverage mounts the production panel with detail bytes round-tripped
through the actual hero.proto. Its gateway doubles and controlled clock validate
client behavior only, not server persistence, real elapsed time or browser layout.
The reconstructed-panel regression fails on the unchanged base. Error handling,
known deadlines, one-click submission, upgrade continuation, FIFO detail refresh
and navigation/actor/unmount cases are covered alongside existing training suites.

## Draft acceptance gate

Use actual gateway + isolated PostgreSQL + real Chromium at 1280×720 and 1600×900.
Begin training, reload, verify unknown text and no automatic command, test early
rejection, then claim a genuinely due session and verify persisted EXP/idle state
and upgrade continuation. Disclose any controlled-time fixture instead of calling
it natural elapsed time. Inspect keyboard/mouse, focus, scrolling, repeated clicks,
hero/account/navigation changes and interrupted requests. #2265 startup evidence
is not this feature's acceptance. Keep Draft until independent exact-head source,
#2004/#2065 composition, all applicable CI and this live gate pass. No held ref or
production changes; preserve both sides of known cleanup/navigation conflicts.
