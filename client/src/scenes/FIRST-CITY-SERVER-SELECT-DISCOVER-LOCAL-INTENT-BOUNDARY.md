# ServerSelect Discover vs journal latest local intent

CLIENT-FIRST-CITY-DISCOVER-LOCAL-INTENT-BOUNDARY-001 stacks on #2852.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **DiscoverFirstCityIntent refreshes authoritative
actor/head from the server when durable head is command — not journal's latest local intent by default**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). `empty` head withholds the row (Discover empty-head path is #2846).
Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `runFirstCityDiscoverProbe` / `FirstCityController.discover` / journal. No automatic Discover, no main-city navigation, no playable-first-city claims.