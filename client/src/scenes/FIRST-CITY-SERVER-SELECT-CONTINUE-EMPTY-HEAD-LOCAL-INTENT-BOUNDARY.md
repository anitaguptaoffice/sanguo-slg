# ServerSelect Continue empty-head gate vs journal latest local intent

CLIENT-FIRST-CITY-CONTINUE-EMPTY-HEAD-LOCAL-INTENT-BOUNDARY-001 stacks on #2970.

When loopback knowledge has durable `head` = **empty** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Continue empty-head gate follows resolveFirstCityContinueEmptyHeadBoundaryView / canOfferFirstCityContinue (empty head: Continue off) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2803 Continue empty-head boundary and #2961 Continue commandId boundary without
changing `canOfferFirstCityContinue` / `resolveFirstCityContinueEmptyHeadBoundaryView`. `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue, no main-city navigation, no playable-first-city claims.