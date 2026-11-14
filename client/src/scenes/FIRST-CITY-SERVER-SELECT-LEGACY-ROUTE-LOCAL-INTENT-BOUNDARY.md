# ServerSelect legacy route vs journal latest local intent

CLIENT-FIRST-CITY-LEGACY-ROUTE-LOCAL-INTENT-BOUNDARY-001 stacks on #2932.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **legacy route boundary display follows resolveFirstCityLegacyRouteBoundaryView (wire §1) —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §1). Complements #2745 legacy route boundary without
changing `resolveFirstCityLegacyRouteBoundaryView`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.