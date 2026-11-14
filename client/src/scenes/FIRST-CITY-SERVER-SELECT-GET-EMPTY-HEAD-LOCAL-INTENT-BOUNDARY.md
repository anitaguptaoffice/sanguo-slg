# ServerSelect GetResult empty-head gate vs journal latest local intent

CLIENT-FIRST-CITY-GET-EMPTY-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2974.

When loopback knowledge has durable `head` = **empty** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 GetResult empty-head lookup gate follows resolveFirstCityGetEmptyHeadBoundaryView / canOfferFirstCityResult (owned commandId on EMPTY head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2811 Get empty-head boundary and #2956 Get commandId boundary without
changing `canOfferFirstCityResult` / `resolveFirstCityGetEmptyHeadBoundaryView`. `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.