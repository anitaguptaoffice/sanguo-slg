# ServerSelect same-ID local C1 vs journal latest local intent

CLIENT-FIRST-CITY-LOCAL-C1-DIVERGENCE-LOCAL-INTENT-BOUNDARY-001 stacks on #2908.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **C1 byte divergence listing follows intents vs retained records —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §4). Complements #2751 `local-c1-divergence` row without
changing `resolveFirstCityLocalC1DivergenceView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.