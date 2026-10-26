# API-CITY-SCOPE-001: shard-less domestic cache boundary

`domestic.Hub` and API city/military caches are keyed by numeric city ID, not
`(server_id, city_id)`. A world ownership row alone cannot choose the correct Hub.
For PG-backed API servers, `domesticCityScope` checks the Hub's immutable pool
identity and configured shard before city reads, upgrades, troop recruitment,
marches (including unfiltered lists), hero city-chief ownership, hydration or
post-commit wallet refresh.
Build-speedup consumables are rejected before bag loading/debit on scope mismatch;
the helper independently checks the captured shard. Non-build effects remain
shard-keyed content operations. `WireM4Content` binds the exact service/catalog
pair for the precheck; unbound alternate service wiring fails closed rather than
classifying effects against a different catalog.
It reuses the DOM provenance capability; it never retargets an existing Hub.

Hero ownership additionally requires the authoritative world row before reading
or loading domestic state, even if a matching player ID is already cached.
Unavailable world ownership fails closed. Nil-API-pool memory fixtures remain
explicitly local; this change does not implement multi-shard Hub routing.
Template hero recruitment remains independently shard-keyed, but a committed
foreign-shard wallet operation cannot refresh the configured Hub's cities.

`city_scope_test.go` uses real PostgreSQL with identical player/city IDs on two
shards and checks preloaded-Hub hydration into a fresh API cache, warm/cold
rejection, distinct pools, unchanged wallet/proof/
queue/assignment rows and caches, unavailable-world denial, and same-shard success.
