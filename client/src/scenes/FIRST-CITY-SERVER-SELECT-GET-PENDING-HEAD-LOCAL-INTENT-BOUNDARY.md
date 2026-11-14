# ServerSelect GetResult pending-head gate vs journal latest local intent

CLIENT-FIRST-CITY-GET-PENDING-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2980.

When loopback knowledge has durable `head` = **command · pending** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 GetResult pending-head lookup gate follows resolveFirstCityGetPendingHeadBoundaryView / canOfferFirstCityResult (owned commandId on PENDING head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2815 Get pending-head boundary and #2852 Get local intent without
changing `canOfferFirstCityResult` / `resolveFirstCityGetPendingHeadBoundaryView`. `empty` / non-pending `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.