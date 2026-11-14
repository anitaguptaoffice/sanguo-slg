# ServerSelect stale-actor gate vs journal latest local intent

CLIENT-FIRST-CITY-STALE-ACTOR-LOCAL-INTENT-BOUNDARY-001 stacks on #3042.

When loopback panel detects **stale-actor** drift (`firstCityStaleActor`) and journal retains a **latest** local intent,
shows a read-only boundary row: **stale-actor isolation follows firstCityActorBindingDrifted / firstCitySessionActorDrifted (#2687) —
not journal's latest retained intent alone**
([CITY_CREATION_RECOVERY.md](../../../spec/rules/CITY_CREATION_RECOVERY.md) §4 / §10.6;
[FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §2). Complements #2687 stale notice and action local-intent withhold rules
without changing `firstCityStaleActor`, `assertFirstCityActorFresh`, or Submit/Continue/Get send paths.
Fresh actor, empty journal, or no knowledge withholds the row.
No automatic Discover/Submit/Continue, no main-city navigation, no playable-first-city claims.