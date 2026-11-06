# Recruit reply ownership

CLIENT-RECRUIT-REPLY-OWNER-001, issue #2049. Client-only; existing RecruitTroop request, server debit/queue creation and receipt contracts are unchanged.

The military button submits a command asynchronously. Previously success checked only session object identity while failure had no ownership check. A scene exit, mutable actor/city change or same-object relogin could apply an old balance/queue or overwrite a newer form with an old error. The command now captures actor primitives, authentication generation, session identity and scene lifecycle. A unique operation owner fences old completion and cannot clear a newer pending operation. Enter/leave reset local pending state. Current pending commands are not submitted twice; current success/error and omitted-gold resource merging remain unchanged.

This does not cancel, resend, roll back or recover an already submitted server command. An invalidated reply is not applied to a new view. Unknown server outcomes and authoritative queue recovery remain outside this card; it does not promise durable queue reconstruction. No resource/asset protocol changes or economic reconciliation are introduced.

Regression-first controller tests cover success/failure, actor/city/server/relogin, same-session exit/reentry, replacement session, overlapping generations, single-flight and current receipt/error controls; a mounted military-button event verifies dispatch wiring. Independent review, full client suite/build, exact-head CI and main CI are required. Native browser/live-server acceptance and deployment are not claimed.

Held #2000 shares MainCityScene but changes independent march-unit code. Combination verification uses a disposable worktree only; its historical startMarch conflict preserves both ensureMarchHeroActor() and readMarchUnitCfgId(). Neither its branch nor hold is changed.
