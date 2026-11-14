# ServerSelect GetResult succeeded-head gate vs journal latest local intent

CLIENT-FIRST-CITY-GET-SUCCEEDED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3027.

When loopback knowledge has durable `head` = **command · succeeded** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 GetResult succeeded-head lookup gate follows resolveFirstCityGetSucceededHeadBoundaryView / canOfferFirstCityResult (owned commandId on succeeded head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2826 Get succeeded-head boundary and #2852 Get local intent without
changing `canOfferFirstCityResult` / `resolveFirstCityGetSucceededHeadBoundaryView`. `empty` / non-succeeded `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.