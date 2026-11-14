# ServerSelect actor discovery EMPTY vs journal latest local intent

CLIENT-FIRST-CITY-DISCOVERY-EMPTY-LOCAL-INTENT-BOUNDARY-001 stacks on #2905.

When loopback knowledge has durable `head` = **EMPTY** and journal retains a **latest** local intent,
shows a read-only boundary row: **actor discovery EMPTY display follows durable empty head from Discover —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). Complements #2725 `discovery-empty` row and
#2857 Discover journal boundaries (command head only) without changing `resolveFirstCityDiscoveryEmptyView`.
`command` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.