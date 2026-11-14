# ServerSelect Continue vs journal latest local intent

CLIENT-FIRST-CITY-CONTINUE-LOCAL-INTENT-BOUNDARY-001 stacks on #2760.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **Continue sends the head proposal, not the journal's
latest local intent**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). `empty` head withholds the row (Submit path is #2760).
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue, no main-city navigation, no playable-first-city claims.