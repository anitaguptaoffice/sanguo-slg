# ServerSelect Discover gate vs pending durable head

CLIENT-FIRST-CITY-DISCOVER-PENDING-HEAD-BOUNDARY-001 stacks on #2826.

When loopback knowledge has durable `head` = **pending**, shows a read-only boundary row:
**DiscoverFirstCityIntent is read-only actor refresh only; does not substitute Continue execution or competing Submit**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5).
`empty`, `rejected`, and `succeeded` heads withhold the row (EMPTY uses `discovery-empty` instead). Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `runFirstCityDiscoverProbe` / `FirstCityController.discover` / journal. No automatic Continue, no main-city navigation, no playable-first-city claims.