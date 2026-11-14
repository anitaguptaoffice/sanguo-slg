# ServerSelect Continue gate vs pending durable head

CLIENT-FIRST-CITY-CONTINUE-PENDING-HEAD-BOUNDARY-001 stacks on #2779.

When loopback knowledge has durable `head` = **PENDING command**, shows a read-only boundary row:
**Continue is enabled only on this PENDING head; explicit click required before V2 execution**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6) / §6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `rejected`, and `succeeded` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityContinue` PENDING-only wiring. No automatic Continue, no main-city navigation, no playable-first-city claims.