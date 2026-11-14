# ServerSelect canonical winner vs journal latest local intent

CLIENT-FIRST-CITY-CANONICAL-WINNER-LOCAL-INTENT-BOUNDARY-001 stacks on #2861.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **canonical winner display follows durable head only,
not journal's latest local intent**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2692 canonical winner row and
#2764/#2852/#2858/#2861 action local-intent boundaries without changing winner reducer logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.