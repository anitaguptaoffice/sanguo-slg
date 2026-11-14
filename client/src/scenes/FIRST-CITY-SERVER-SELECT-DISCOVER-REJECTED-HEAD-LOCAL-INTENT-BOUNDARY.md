# ServerSelect Discover rejected-head gate vs journal latest local intent

CLIENT-FIRST-CITY-DISCOVER-REJECTED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3017.

When loopback knowledge has durable `head` = **command · rejected** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Discover rejected-head gate follows resolveFirstCityDiscoverRejectedHeadBoundaryView (read-only authoritative refresh on rejected head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2 / §5–§6). Complements #2835 Discover rejected-head boundary and #2852 Discover local intent without
changing `resolveFirstCityDiscoverRejectedHeadBoundaryView`. `empty` / non-rejected `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Discover, no main-city navigation, no playable-first-city claims.