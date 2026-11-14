# ServerSelect same-ID local vs server C1 divergence

CLIENT-FIRST-CITY-LOCAL-C1-DIVERGENCE-001 stacks on #2749.

When loopback knowledge has a local intent and a server-retained record for the same command ID,
shows read-only **C1 byte** fingerprints when `FirstCityIntent.encode()` does not match the server
record ([FIRST-CITY-WIRE.md](../../../spec/proto/FIRST-CITY-WIRE.md) §4). Distinct from proposal-field
local draft (#2699) and durable head C1 (#2748). Stale-actor, unavailable, and incomplete evidence
withhold the display. No automatic Continue/Submit, no main-city navigation, no playable-first-city claims.