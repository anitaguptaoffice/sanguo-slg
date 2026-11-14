# ServerSelect Discover gate vs EMPTY durable head

CLIENT-FIRST-CITY-DISCOVER-EMPTY-HEAD-BOUNDARY-001 stacks on #2842.

When loopback knowledge has durable `head` = **EMPTY**, shows a read-only boundary row:
**DiscoverFirstCityIntent is read-only actor refresh only; does not substitute V2 Submit (EMPTY predecessor) or PENDING-only Continue**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §5.2(6);
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §5 / §6).
Coexists with the `discovery-empty` observation row without replacing it. `pending`, `rejected`, and `succeeded` heads withhold the row.
Stale-actor, unavailable, and incomplete evidence withhold the display.
Does not change loopback `runFirstCityDiscoverProbe` / `FirstCityController.discover` / journal. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.