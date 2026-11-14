# ServerSelect Continue gate vs succeeded durable head

CLIENT-FIRST-CITY-CONTINUE-SUCCEEDED-HEAD-BOUNDARY-001 stacks on #2790.

When loopback knowledge has durable `head` = **succeeded command**, shows a read-only boundary row:
**Continue is PENDING-only; SUCCEEDED terminal lineage is not re-executed via Continue**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(7) / §6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `pending`, and `rejected` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityContinue` PENDING-only wiring or `buildContinueRequest`. No automatic Continue, no main-city navigation, no playable-first-city claims.