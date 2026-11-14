# ServerSelect durable head C1 vs journal latest local intent

CLIENT-FIRST-CITY-DURABLE-HEAD-C1-LOCAL-INTENT-BOUNDARY-001 stacks on #2912.

When loopback knowledge has durable `head` = **command** (commandId ≠ journal latest) and journal retains a **latest** local intent,
shows a read-only boundary row: **durable head C1 fingerprint follows head record encode() —
not journal's latest local intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §3 / §5.2(2) / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §4). Complements #2749 durable head C1 row without
changing `resolveFirstCityDurableHeadC1View`. `empty` head or matching journal commandId withholds the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
No main-city navigation, no playable-first-city claims.