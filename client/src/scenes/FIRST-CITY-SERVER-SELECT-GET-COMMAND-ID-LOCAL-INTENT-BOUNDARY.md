# ServerSelect GetResult commandId field vs journal latest local intent

CLIENT-FIRST-CITY-GET-COMMAND-ID-LOCAL-INTENT-BOUNDARY-001 stacks on #2950.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **GetResult fc-command-id suggestion follows suggestFirstCityResultCommandId (head=command → head ID only) —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.6 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2852 Get vs journal without
changing `suggestFirstCityResultCommandId`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic GetResult, no main-city navigation, no playable-first-city claims.