# ServerSelect legacy route boundary notice

CLIENT-FIRST-CITY-LEGACY-ROUTE-BOUNDARY-001 stacks on #2741.

When loopback ServerSelect V2 first-city probe is visible, shows **read-only** copy that
legacy `world.v1` `CreateCity` and the four `world.v2` routes stay independent per
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §1 and
[CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §10.6:
no silent fallback from failed/unknown V2 to v1 creation, and login/enter does not create a city.
Distinct from Discover status, stale-actor notices, and durable-head outcome rows.
