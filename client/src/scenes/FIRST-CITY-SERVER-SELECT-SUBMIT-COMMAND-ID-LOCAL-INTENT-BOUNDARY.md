# ServerSelect Submit commandId vs journal latest local intent

CLIENT-FIRST-CITY-SUBMIT-COMMAND-ID-LOCAL-INTENT-BOUNDARY-001 stacks on #2961.

When loopback knowledge has durable `head` = **empty** and journal retains a **latest** local intent,
shows a read-only boundary row: **V2 Submit payload commandId follows buildSubmitRequest (empty head → new RNG commandId) —
not journal's latest retained commandId alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2–§5.3 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §3 / §5). Complements #2765 Submit commandId boundary without
changing `buildSubmitRequest` / `canOfferFirstCitySubmit`. `command` head or empty journal withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No automatic Submit, no main-city navigation, no playable-first-city claims.