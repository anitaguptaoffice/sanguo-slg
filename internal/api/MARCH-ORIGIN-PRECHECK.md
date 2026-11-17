# StartMarch origin validation before side effects

Issue #2394 fixes the active legacy missing-origin failure path. The gateway still
checks session/shard, ownership, domestic snapshot, hero ID and normalized troop
input first. It then requires a cached origin before settling production or
claiming a hero. Missing origins keep code 50005 and `city coordinates unknown`,
without wallet/checkpoint settlement, force consumption, hero status changes,
military registration or army/index publication. Present zero coordinates remain
valid. No coordinate fallback, retry, new RPC or persistence writer is introduced.

The reachable recovery sequence is a failed login hydration WORLD read followed
by GetCityChief's legitimate lazy domestic load. That load does not populate the
origin cache. The former check ran after claim and could strand a busy hero with
spent force despite rejecting the march. A later normal hydration plus explicit
retry still dispatches using the WORLD coordinates and spends force once.

The new tests cover repeated rejection with registered/unregistered military
state, earlier validation order, and zero-coordinate success. The PG regression
creates a city through the real handler, uses a fresh server and PostgreSQL pool,
fails only the initial WORLD listing, and calls the real chief handler to load
DOM state. It never deletes a coordinate cache entry. Independent-pool snapshots
cover city/wallet/checkpoint/building/queue/hero/force/army/march rows. Synthetic
stock and bounded clocks are explicit continuation fixtures, not native gameplay
or durable march acceptance. Existing full API ordinary/race CI runs these tests.
Local Go execution is unavailable; no local Go or PostgreSQL pass is claimed.

Scope was coordinated with #1937 and #1949 before edits. Their dormant gate,
readiness, unsupported-purpose, durable cutover and activation dependencies remain
blocked. This changes one active exceptional path, not all legacy behavior.
Later insufficient-stock/store failures and ignored hero-release errors remain
separate; this is not cross-domain atomic dispatch or restart recovery. #2377,
#2379, all historical holds and the no-deployment boundary are unchanged.
