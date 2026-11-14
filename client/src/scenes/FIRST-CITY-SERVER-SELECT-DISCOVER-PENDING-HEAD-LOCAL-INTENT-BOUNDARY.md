# ServerSelect Discover pending-head gate vs journal latest local intent

CLIENT-FIRST-CITY-DISCOVER-PENDING-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2985.

When loopback knowledge has durable `head` = **command · pending** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Discover pending-head gate follows resolveFirstCityDiscoverPendingHeadBoundaryView (read-only authoritative refresh on PENDING head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2 / §5). Complements #2828 Discover pending-head boundary and #2852 Discover local intent without
changing `resolveFirstCityDiscoverPendingHeadBoundaryView`. `empty` / non-pending `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Discover, no main-city navigation, no playable-first-city claims.