# ServerSelect Discover gate vs rejected durable head

CLIENT-FIRST-CITY-DISCOVER-REJECTED-HEAD-BOUNDARY-001 stacks on #2828.

When loopback knowledge has durable `head` = **rejected** (`rejected_no_effect`), shows a read-only boundary row:
**DiscoverFirstCityIntent is read-only actor refresh only; does not substitute Submit successor or Continue execution**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(7);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `pending`, and `succeeded` heads withhold the row (EMPTY uses `discovery-empty` instead). Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `runFirstCityDiscoverProbe` / `FirstCityController.discover` / journal. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.