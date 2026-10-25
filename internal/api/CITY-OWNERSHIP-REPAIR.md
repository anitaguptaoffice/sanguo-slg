# API-REPAIR-003 validation boundary

Domestic read/upgrade handlers authorize city ownership through the world store
using the authenticated session shard and player before accrual, queue mutation,
or quest hooks. Domestic cache entries also must match the player. Ownership
lookup failure and unavailable/missing city data fail closed with the existing
`WORLD_CITY_NOT_FOUND` response; packet shard mismatch retains its existing error.
The shared military ownership helper no longer trusts shard-less cached cities.

Regression coverage: two players, own/foreign reads and upgrades, same-player
other-shard city, explicit packet shard mismatch, missing/nonpositive IDs, absent
store, store error, unloaded/stale domestic cache, unchanged denied city/quest
state, plus concurrent domestic ticks and existing military positive flows.

This is request-boundary authorization, not a transactional ownership-transfer
protocol: concurrent conquest/ownership transfer would require cross-domain
locking/version checks and remains outside this repair. No protocol/schema,
error-number, permission, or online-account changes.
