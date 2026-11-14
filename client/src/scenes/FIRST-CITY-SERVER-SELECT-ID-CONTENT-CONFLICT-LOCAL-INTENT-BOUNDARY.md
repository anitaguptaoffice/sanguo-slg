# ServerSelect ID_CONTENT_CONFLICT vs journal latest local intent

CLIENT-FIRST-CITY-ID-CONTENT-CONFLICT-LOCAL-INTENT-BOUNDARY-001 stacks on #2896.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **ID_CONTENT_CONFLICT intake follows retained
idContentConflict observations — not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §3 / §5 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2708 ID_CONTENT_CONFLICT row and
#2896 HEAD_CONFLICT journal boundaries without changing `collectIdContentConflicts` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.