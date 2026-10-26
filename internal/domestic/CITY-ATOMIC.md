# Atomic new-city coordination

`Hub.CreateNewCity` owns Hub lock, transaction and publication. The supplied
WORLD participant runs only after the wallet lock and must use that transaction
without lifecycle/pool/Hub calls. Existing settlements use the same Hub-first
ordering; API must not hold a wallet transaction before entering this method.
API must first match its authentication pool/shard through
`SupportsAtomicCityCreation`; persistence wiring remains startup-only/immutable.

World, wallet, checkpoint, buildings and queue commit together. Input stays
unchanged; Hub/scheduler publish only after confirmed commit. A commit transport
error can be unknown: never infer absence, blindly retry or compensate. A committed
complete city can be loaded after a lost response; legacy missing checkpoints
are never adopted or repaired by this port. API publication belongs after return.

This internal port requires the independently reviewed WORLD participant and API
composition, plus the checkpoint rollout gates. No standalone deployment claim.
