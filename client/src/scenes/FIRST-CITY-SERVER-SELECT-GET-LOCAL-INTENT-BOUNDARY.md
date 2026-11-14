# ServerSelect GetResult vs journal latest local intent

CLIENT-FIRST-CITY-GET-LOCAL-INTENT-BOUNDARY-001 stacks on #2846.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **GetResult suggestion prefers head commandId when
durable head is command; lookup is by explicit owned commandId only — not journal's latest local intent by default**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). `empty` head withholds the row (Get empty-head path is #2811).
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.