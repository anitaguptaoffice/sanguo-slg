# ServerSelect NOT_OBSERVED lookup display

CLIENT-FIRST-CITY-NOT-OBSERVED-001 ([#2712](https://github.com/anitaguptaoffice/sanguo-slg/issues/2712)) stacks on #2709.

Loopback ServerSelect V2 first-city panel shows **read-only** rows for retained `notObserved` observations from
Submit/Continue/GetResult: the requested `commandId` and the observation's **response-time durable head** (command or EMPTY).
This is command lookup authority, not actor discovery EMPTY (canonical winner line). Canonical winner, conflict, losing-proposal
and local-draft lines remain separate. Stale-actor, unavailable and incomplete evidence withhold the display. No automatic
Continue/Submit, no main-city navigation, no playable-first-city claims.
