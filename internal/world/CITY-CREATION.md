# Composed durable city creation

`Service.CreateCityInTx(ctx, tx, City) (City, error)` delegates to the optional
`CityCreatorInTx` Store capability. `PGStore` implements it using only the supplied
transaction; neither the pool nor Loader is used. Request CityID must be zero.
The returned ID/city is staged, **not committed or safe to publish**.

The DOM creation coordinator must acquire Hub mutex, begin its transaction and
lock the player's wallet before invoking this participant. WORLD takes the
transaction advisory lock `(0x43495459 /* CITY */, server_id)`, validates the
player's shard identity and exact persisted terrain with shared row locks, then
allocates MAX+1 and INSERTs. Map provisioning must precede creation: missing map
cells fail closed rather than generating chunks outside the transaction.

All composed creators take this shard lock until commit/rollback. Existing unique
constraints remain final: coordinate conflicts return ErrOccupied; primary-key
conflicts return ErrCityIDConflict. Other unique errors are not reclassified.
Uncooperative legacy writers can still cause a safe conflict; never overwrite,
adopt, delete or retry automatically. Drain old writers before activation.

DOM must initialize checkpoint/buildings in this same transaction and own its one
commit. Only confirmed commit success permits Hub/API publication. An unknown
commit result may leave a complete committed city or no city, not a partially
initialized city; report the error without compensation or blind retry. Existing
list/hydrate recovers a completed city after a lost response. Existing world rows
with missing checkpoints remain occupied and fail closed, never lazily seeded.

This WORLD port alone is not deployable: the separate DOM coordinator and API
composition are required. No RPC, schema, gameplay values or credential grants
change. Unexpected SQL errors remain internal; the API must sanitize client errors.

Validation: `DATABASE_URL=... go test -race ./internal/world` uses isolated schemas
for rollback/commit visibility, real owner/terrain guards, concurrent MAX+1 and
coordinate contention, uncooperative-writer ID collision preservation, shard lock
isolation and deferred commit rejection. An unset DATABASE_URL skips those checks;
unit tests alone are not PostgreSQL durability evidence.
