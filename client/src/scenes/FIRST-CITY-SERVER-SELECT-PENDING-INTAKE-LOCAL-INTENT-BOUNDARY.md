# ServerSelect PENDING intake vs journal latest local intent

CLIENT-FIRST-CITY-PENDING-INTAKE-LOCAL-INTENT-BOUNDARY-001 stacks on #2878.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **PENDING intake display follows durable head pending
reception — not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §4). Complements #2721 PENDING intake row and
#2878/#2873 action or playback journal boundaries without changing `resolveFirstCityPendingIntakeView` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.