# ServerSelect authorized scope vs journal latest local intent

CLIENT-FIRST-CITY-AUTHORIZED-SCOPE-LOCAL-INTENT-BOUNDARY-001 stacks on #2923.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **authorized scope display follows Discover `knowledge.scope` —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §3 / §4 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). Complements #2733 authorized scope row without
changing `resolveFirstCityAuthorizedScopeView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.