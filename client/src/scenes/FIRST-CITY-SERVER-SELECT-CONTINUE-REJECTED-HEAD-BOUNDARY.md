# ServerSelect Continue gate vs rejected durable head

CLIENT-FIRST-CITY-CONTINUE-REJECTED-HEAD-BOUNDARY-001 stacks on #2771.

When loopback knowledge has durable `head` = **rejected command**, shows a read-only boundary row:
**Continue stays disabled on this head; successor INITIAL needs new commandId + exact rejected predecessor**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(7) / §6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5).
`empty`, `pending`, and `succeeded` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityContinue` PENDING-only wiring. No automatic Continue, no main-city navigation, no playable-first-city claims.