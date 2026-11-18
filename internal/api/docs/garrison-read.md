# API-REPAIR-004: ready-garrison reads

GetCityState uses authoritative world shard/ownership checks before any military
snapshot, domestic accrual or quest flushing. It then takes one locked deep-copy
military SnapshotCity, validates its owner and configured nonnegative troop rows,
and emits only positive ready balances in ascending unit ID order as field 4.
Missing Hub/city state stays absent (unknown); an existing empty set is present.
The read does not EnsureCity, seed troops, tick queues, or infer completion from a
deadline. Invalid rows/owners reject the request rather than report false emptiness.
Wallet/buildings and troops are separate snapshots, not a cross-domain transaction.

Regression gates: `go test -race ./internal/api -run 'TestCityGarrison|TestDomesticCityOwnership'`.
Tests exercise production handler binary presence, sorting/zero omission, unknown
and invalid rows, owner/shard denial before read/accrual, and concurrent natural
recruit completion versus copied snapshots. This is NOT military PostgreSQL or
queue crash durability; restart recovery and real H5 march/return remain separate gates.
With DATABASE_URL set, TestCityGarrisonPostgresOwnership also exercises the actual
PostgreSQL world ownership lookup and rejects the same player on the wrong shard.

## Prepared local recruiting

With the prepared Recruit generation installed, GetCityState uses committed
stock. It repeats the WORLD owner check under the stock writers' city barrier
and reads the bound MIL marker and four ready balances in one statement. The
transaction rolls back and releases its source lease before publication.
Invalid evidence or a retired source leaves field 4 absent. Four certified
zero balances produce a present empty message. The read never publishes a
stock cache, advances work, or substitutes the legacy Hub. The existing wallet
settlement, building fields, and production rates remain independent.

The PG17 gateway test uses controlled schedule advancement to verify pending
and committed stock, reconstruction, and exact read-after-credit behavior.

The same prepared read transaction reads the current queue under the WORLD
barrier. Field 5 is absent on legacy or unavailable queue evidence; a valid
empty field reports no pending jobs. Invalid queue data does not overwrite the
independently validated garrison. Both fields require confirmed transaction end.
Generate the mirrored Go binding with protoc 36.1 and the go.mod-pinned
protoc-gen-go v1.36.5 using the existing GARRISON-WIRE-REPAIR.md command.
