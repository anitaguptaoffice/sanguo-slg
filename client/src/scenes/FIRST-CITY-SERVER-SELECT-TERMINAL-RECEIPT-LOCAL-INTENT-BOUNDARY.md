# ServerSelect terminal receipt vs journal latest local intent

CLIENT-FIRST-CITY-TERMINAL-RECEIPT-LOCAL-INTENT-BOUNDARY-001 stacks on #2884.

When loopback knowledge has durable `head` = **command**, compares **journal latest** retained local intent to the
head `commandId`. On mismatch, shows a read-only boundary row: **terminal receipt display follows durable head
succeeded/rejected payload — not journal's latest local intent**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2717 terminal receipt row and
#2884/#2878 action or display journal boundaries without changing `resolveFirstCityTerminalReceiptView` logic.
`empty` head withholds the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.