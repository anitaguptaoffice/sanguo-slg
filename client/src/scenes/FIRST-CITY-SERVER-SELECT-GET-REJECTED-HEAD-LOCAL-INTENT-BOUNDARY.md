# ServerSelect GetResult rejected-head gate vs journal latest local intent

CLIENT-FIRST-CITY-GET-REJECTED-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #3011.

When loopback knowledge has durable `head` = **command · rejected** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 GetResult rejected-head lookup gate follows resolveFirstCityGetRejectedHeadBoundaryView / canOfferFirstCityResult (owned commandId on rejected head) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)–§5.2(7) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6). Complements #2821 Get rejected-head boundary and #2852 Get local intent without
changing `canOfferFirstCityResult` / `resolveFirstCityGetRejectedHeadBoundaryView`. `empty` / non-rejected `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.