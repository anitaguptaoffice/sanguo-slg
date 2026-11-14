# ServerSelect Discover gate vs succeeded durable head

CLIENT-FIRST-CITY-DISCOVER-SUCCEEDED-HEAD-BOUNDARY-001 stacks on #2836.

When loopback knowledge has durable `head` = **succeeded**, shows a read-only boundary row:
**DiscoverFirstCityIntent is read-only actor refresh only; does not substitute competing EMPTY Submit, Continue execution, or main-city entry**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6)/(7);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
`empty`, `pending`, and `rejected` heads withhold the row (EMPTY uses `discovery-empty` instead). Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `runFirstCityDiscoverProbe` / `FirstCityController.discover` / journal. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.