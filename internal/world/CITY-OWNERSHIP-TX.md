# Caller-owned city authorization

`Service.LockCityOwnerInTx(ctx, tx, serverID, cityID, playerID) error` delegates to
the optional `CityOwnerLockerInTx` Store capability. `PGStore` reads only through
the supplied transaction; its Pool and the Service Loader are not used. Existing
Store and city creation contracts are unchanged. No gameplay route is activated.

The coordinator must first lock the actor and existing wallet, then call this
port, then acquire any item/candidate locks. Positive IDs are required. The exact
shard/city row is locked `FOR UPDATE` before its authoritative owner is checked;
the lock remains until the caller ends the transaction. Ordinary ownership UPDATE
also blocks. Missing city, foreign shard and wrong owner all return
`ErrCityNotOwned`; storage failures return sanitized `ErrCityOwnershipUnavailable`.
Cancellation is returned as the context error. Roll back on every error.

No wallet/building SQL, cache access, row mutations, DDL, Begin/Commit/Rollback or
fallback exists here. The API owns transaction/pool/schema provenance and lifecycle;
this optional port alone does not establish safe hotel composition or deployment.
`DATABASE_URL=... go test -race ./internal/world` covers supplied-tx connectivity,
guards, caller rollback, cancellation and owner UPDATE blocked through caller end.
