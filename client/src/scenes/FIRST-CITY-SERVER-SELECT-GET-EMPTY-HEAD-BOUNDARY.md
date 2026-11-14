# ServerSelect GetResult gate vs EMPTY durable head

CLIENT-FIRST-CITY-GET-EMPTY-HEAD-BOUNDARY-001 stacks on #2802.

When loopback knowledge has durable `head` = **EMPTY**, shows a read-only boundary row:
**GetResult is read-only lookup by owned commandId only; INITIAL uses V2 Submit with EMPTY predecessor**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`pending`, `rejected`, and `succeeded` heads withhold the row. Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `canOfferFirstCityResult` / `buildGetResultRequest` / journal. No automatic GetResult, no main-city navigation, no playable-first-city claims.