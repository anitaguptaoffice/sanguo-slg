# Same-hero march request admission

StartMarch rejects overlapping requests for one authenticated server/player/hero
with the existing invalid-march code and a request-in-progress message. A brief
index lock owns marker insertion/removal only; no domain call runs under it.
The marker remains through settlement, claim, creation, rejected-claim cleanup
and registration. Every handler return removes it. Other keys remain independent.

Tests pause an actual idle HERO read, reject overlapping requests before resume,
admit another hero, verify one force/troop charge per admitted dispatch, and run
actual MIL completion followed by explicit redispatch. Real PG repeats the flow
and verifies committed hero/force state through a separate pool. Additional gates
cover concurrent first use, namespace separation, cleanup still in flight after
HERO becomes idle, canceled requests, failed/unknown claims and failed settlement.
Seeded ready troops and future PollDue are controlled integration fixtures, not
natural gameplay timing or durable army/restart acceptance.

This is a per-Server admission guard, not durable or cross-domain atomicity.
Other HERO endpoints, separate processes, response-loss retries, unknown writes,
crashes and restart recovery remain outside its guarantee. Existing lifecycle,
costs, error precedence and no-blind-compensation behavior stay intact. Full
ordinary/race regressions and final CI/review are required; local Go is unavailable.
