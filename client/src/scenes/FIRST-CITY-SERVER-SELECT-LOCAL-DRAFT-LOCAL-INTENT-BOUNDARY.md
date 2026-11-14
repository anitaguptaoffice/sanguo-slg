# ServerSelect same-ID local draft vs journal latest local intent

CLIENT-FIRST-CITY-LOCAL-DRAFT-LOCAL-INTENT-BOUNDARY-001 stacks on #2887.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **same-ID draft divergence listing follows retained
records per commandId — not journal's latest local intent**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2702 local draft row and
#2887/#2884 action or display journal boundaries without changing `resolveFirstCityLocalDraftView` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.