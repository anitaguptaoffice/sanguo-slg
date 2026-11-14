# ServerSelect COMMAND outcome vs journal latest local intent

CLIENT-FIRST-CITY-COMMAND-OUTCOME-LOCAL-INTENT-BOUNDARY-001 stacks on #2873.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **COMMAND playback follows retained COMMAND
observations — not journal's latest intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2730 COMMAND outcome row and
#2873/#2867/#2852 action or winner/loser journal boundaries without changing `collectCommandOutcomes` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.