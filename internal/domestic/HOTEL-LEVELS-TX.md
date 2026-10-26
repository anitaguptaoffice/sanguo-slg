# Persisted hotel levels participant

Obtain `Hub.HotelLevelsPort` after startup `UseStore`. Bind `Supports(apiPool,
serverID)` before beginning an operation; the port freezes exact pool/shard and
rejects replaced store, retargeted pool, nil or memory-only wiring. Wiring is
startup-only, not a concurrent reconfiguration interface. `pgx.Tx` does not expose
its originating pool: the API must supply the transaction from that bound pool.

The API owns READ COMMITTED begin/commit/rollback. Before `LevelsInTx`, it must
lock the existing authenticated actor, then existing wallet, then use WORLD to
authorize the city and hold its row FOR UPDATE. This port cannot establish city
existence/ownership: missing buildings (including an absent city) return zero.
Cfg 8/1 retain `COALESCE(MAX(level),0)` hotel/office semantics, not cached levels.
Storage/scan failures return `ErrHotelLevelsUnavailable`, without SQL/schema
diagnostics. Cancellation and deadline failures retain their context identities.

Source lock audit: `wallet.go:walletOperation` and `SettleCityWithProduction`
hold Hub before `pg_store.go:saveCityWithWorld` locks wallet; that transaction
checks city ownership in `production_store.go:loadProductionCheckpoint` before
deleting/reinserting buildings. The shared wallet orders those writes before this
read. Never acquire Hub while holding the wallet. The participant uses only one
supplied-tx SELECT, no pool acquisition, lifecycle, cache, DDL or writes.

This prerequisite has no API call site or activation. Actual coordinator lock
ordering and complete hotel/family integration require their separate cards.
