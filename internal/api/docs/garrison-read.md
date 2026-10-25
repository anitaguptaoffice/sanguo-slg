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
