# ServerSelect head predecessor vs journal latest local intent

CLIENT-FIRST-CITY-HEAD-PREDECESSOR-LOCAL-INTENT-BOUNDARY-001 stacks on #2919.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **head `proposal.predecessor` display follows durable head record —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5 / §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §3). Complements #2741 head predecessor row without
changing `resolveFirstCityHeadPredecessorView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.