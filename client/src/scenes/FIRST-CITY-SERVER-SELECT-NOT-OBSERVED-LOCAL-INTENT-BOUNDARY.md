# ServerSelect NOT_OBSERVED vs journal latest local intent

CLIENT-FIRST-CITY-NOT-OBSERVED-LOCAL-INTENT-BOUNDARY-001 stacks on #2900.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **NOT_OBSERVED lookup follows retained notObserved
observations — not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). Complements #2712 NOT_OBSERVED row and
#2900 ID_CONTENT_CONFLICT journal boundaries without changing `collectNotObserved` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.