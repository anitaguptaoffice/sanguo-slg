# ServerSelect GetResult gate vs rejected durable head

CLIENT-FIRST-CITY-GET-REJECTED-HEAD-BOUNDARY-001 stacks on #2814.

When loopback knowledge has durable `head` = **rejected** (`rejected_no_effect`), shows a read-only boundary row:
**GetResult is read-only lookup by owned commandId only; does not substitute Submit successor or Continue execution**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(7);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `pending`, and `succeeded` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityResult` / `buildGetResultRequest` / journal. No automatic GetResult, no main-city navigation, no playable-first-city claims.