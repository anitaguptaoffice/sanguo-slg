# DOM PreparedCity lifecycle (default-off)

DOM-FRESH-PREPARED-CITY-001 (#2532) adds `FreshCityParticipant.Prepare` and the
`PreparedCity` handle for the reviewed fresh-create preparation gate and staged DOM work.
It does not enroll sources, Begin transactions, wire API routes, deploy writers or
enable the V2 first-city player flow.

`Prepare` clones the trusted template (`snapshotFreshTemplate`) and acquires the
cancellable Hub preparation mutex without SQL. `Close` releases the gate once and
discards unpublished staged state.

`LockWallet` is one-shot per handle. It requires the participant `PinWallet` state,
preserves an existing wallet (`ON CONFLICT DO NOTHING`), and reads the authoritative
row `FOR UPDATE` inside the caller transaction.

`Stage` is one-shot. It requires DOM city relation pins, consumes `march.InitializedCity`,
verifies `player_city` ownership, rejects pre-existing DOM rows, inserts checkpoint and
building rows, and retains private staged `CityState`.

`Publish` is one-shot and performs no SQL. It registers Hub caches via
`registerCityLocked` only while the preparation gate remains held.

Independent review, affected-package tests and exact-head CI are merge gates.
APP composition, WORLD issuance, ACCOUNT pins and production activation remain separate.
