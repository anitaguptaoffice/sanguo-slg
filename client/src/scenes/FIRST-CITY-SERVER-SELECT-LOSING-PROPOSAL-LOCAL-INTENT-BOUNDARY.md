# ServerSelect losing-proposal vs journal latest local intent

CLIENT-FIRST-CITY-LOSING-PROPOSAL-LOCAL-INTENT-BOUNDARY-001 stacks on #2867.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **losing-proposal listing follows non-head knowledge,
not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2695 losing-proposal row and
#2867/#2764/#2852/#2858/#2861 action or winner journal boundaries without changing loser collection logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.