# ServerSelect GetResult gate vs succeeded durable head

CLIENT-FIRST-CITY-GET-SUCCEEDED-HEAD-BOUNDARY-001 stacks on #2820.

When loopback knowledge has durable `head` = **succeeded**, shows a read-only boundary row:
**GetResult is read-only lookup by owned commandId only; does not substitute Submit INITIAL or Continue execution**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `pending`, and `rejected` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityResult` / `buildGetResultRequest` / journal. No automatic GetResult, no main-city navigation, no playable-first-city claims.