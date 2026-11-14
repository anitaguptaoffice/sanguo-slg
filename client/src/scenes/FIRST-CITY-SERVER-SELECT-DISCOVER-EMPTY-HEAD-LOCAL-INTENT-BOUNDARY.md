# ServerSelect Discover empty-head gate vs journal latest local intent

CLIENT-FIRST-CITY-DISCOVER-EMPTY-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2977.

When loopback knowledge has durable `head` = **empty** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Discover empty-head gate follows resolveFirstCityDiscoverEmptyHeadBoundaryView (read-only actor/head refresh on EMPTY head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2 / §5 / §6). Complements #2846 Discover empty-head boundary and #2907 discovery-empty local intent without
changing `resolveFirstCityDiscoverEmptyHeadBoundaryView` / discover probe. `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Discover substitution for Submit, no main-city navigation, no playable-first-city claims.