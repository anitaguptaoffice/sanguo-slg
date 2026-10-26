# Atomic new-city creation boundary

CreateCity resolves an omitted shard to the authenticated session and rejects a
mismatch before domain work. The domestic Hub must explicitly use the same PG
pool as the API and the same shard. Missing/miswired dependencies fail closed;
NewServer never retargets a Hub or supplies a memory fallback.

API builds ID-zero world/domestic templates, preserving name/coordinate defaults,
8000/8000/5000/5000 starter resources and hall/farm level 1. It invokes domestic
`CreateNewCity` with a callback calling WORLD `CreateCityInTx` exactly once using
the supplied transaction. API does not allocate IDs, begin a transaction or issue
world SQL. Lock order is Hub -> wallet -> world allocation/validation -> domestic
checkpoint -> commit. API holds no cache lock while entering DOM.

Only confirmed commit success permits domestic publication, then API cache,
coordinates, military readiness and create success telemetry. Coordinate reads
and publication share the API cache mutex so concurrent creators/readers do not
race. Existing wallet balances are authoritative; another city grants no starter
resources again. API returns only known occupied/terrain/bounds messages or a
sanitized internal error, logging underlying SQL details server-side.

## Failure and recovery

Confirmed validation/participant/DOM/deferred-constraint failures roll back world
and domestic state together. After resolving such a confirmed failure, retry can
succeed. A transport error during Commit can instead be **unknown**: PostgreSQL
has all or none of the complete city. API publishes nothing and neither blindly
retries nor claims absence. Reload existing ListPlayerCities + hydrate/LoadCity
before deciding what to do; a lost reply does not imply failed creation.

A committed city remains recoverable through a fresh pool/Hub. Existing legacy
orphans stay occupied and fail closed through LoadCity; no conflict adoption,
checkpoint fallback, city deletion, compensation or runtime backfill is added.
A listed world summary alone is not proof of domestic readiness.

`TestCreateCityRegistration*` uses isolated PostgreSQL schemas for exact new-city
clock/reload, deferred failure then retry, and independently seeded legacy-orphan
rejection. Run with DATABASE_URL; skipped PG tests are not durability evidence.
This local group is not rollout approval: old-writer drain, reviewed gated
backfill and complete checkpoint coverage remain prerequisites.

Advanced evidence: `TestCreateCityAtomicConcurrentRequests` races same/distinct
coordinates through two Hubs with shared and independent wallets, including
simultaneous calls on one API instance and a barrier before WORLD allocation. `TestCreateCityAtomicUnknownCommitAndReload` drops an actual
plaintext PostgreSQL COMMIT acknowledgement after receiving the successful tag;
it proves one callback/commit attempt, no false API publication, complete persisted
state, and recovery via listing/hydration without adopting/regranting on conflict.
The wire fault is not a power-loss or general network-fault simulation.
