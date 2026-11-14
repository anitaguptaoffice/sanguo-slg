# ServerSelect HEAD_CONFLICT vs journal latest local intent

CLIENT-FIRST-CITY-HEAD-CONFLICT-LOCAL-INTENT-BOUNDARY-001 stacks on #2891.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **HEAD_CONFLICT intake follows retained
headConflict observations — not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2704 HEAD_CONFLICT row and
#2891/#2887 action or draft journal boundaries without changing `collectHeadConflicts` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.