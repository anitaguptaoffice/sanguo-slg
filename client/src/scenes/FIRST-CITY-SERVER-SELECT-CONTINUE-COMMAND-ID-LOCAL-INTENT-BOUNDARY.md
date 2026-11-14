# ServerSelect Continue commandId vs journal latest local intent

CLIENT-FIRST-CITY-CONTINUE-COMMAND-ID-LOCAL-INTENT-BOUNDARY-001 stacks on #2956.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Continue payload commandId follows buildContinueRequest (head=command → head proposal.commandId only) —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.6 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5). Complements #2764 Continue vs journal without
changing `buildContinueRequest` / `canOfferFirstCityContinue`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Continue, no main-city navigation, no playable-first-city claims.