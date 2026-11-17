# Captured DOM template PostgreSQL companion

Uses the adopted freshSourcePGFixture and actual NewFreshCityParticipant. Startup
uses exactly the same pool/shard as Binding and explicitly checks Hub correspondence.
No UseStore queue binder, arbitrary validator clone or successful source mock exists.
An additional test startup fixes private Hub fields once before its real constructor;
it models an independent release in an owned fixture, not a production second-Hub
execution workaround, online rebind or permission to recapture expected provenance.

DataOnly checks ordinary/quoted schemas, populated wallet (including gold), city,
checkpoint, research and work queue rows, full caller settings, unassigned xact ID,
no retained source relation locks, literal current-default bytes, isolated actors,
malformed digest/zero player, no cache publication, and caller Commit/Rollback.
The participant remains usable after normal startup/command transaction ending.
NoHubGate holds the real Hub mutex and requires bounded completion without taking it.
ReleaseCatalog constructs ten distinct valid catalogs changing every BuildingSpec
field on unused ID 7, plus cardinality. Each mismatch refuses execution data without
retiring either healthy source or changing retained bytes/business rows/cache.
Matching old/new captures remain independently usable. RetainedData restores exact
old resources/buildings despite changed new template/rules labels and new defaults.
Retirement uses a real Pin to discover sequential Hub catalog drift; restoring the
original catalog cannot revive either alias. Pure content validation still succeeds.

All five roots and twelve named children must PASS in full PG17 ordinary and race
streams. Compilation with PG skipped is not database acceptance. These tests do not
cover APP semantic manifests, receipts/history APIs, actual admission close/poison,
commit uncertainty, process restart or WORLD/MIL effects. Those need their own
adopted code and acceptance; successful pure parsing cannot stand in for any of them.
This companion, source and CI form one review/test gate before any member merges.
No real PG was run while preparing this outside candidate. No service was started.
