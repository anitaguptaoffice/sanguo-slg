# Fresh DOM catalog CI evidence

This gate belongs to CI-DOM-FRESH-EVIDENCE-001. It depends on the complete,
independently reviewed source #2438 plus PostgreSQL companion #2439, never
either half alone. It adds no domain code, runner, privilege or dependency.

## Source-frozen inventory

The inventory in dom_fresh_catalog_gate.py was derived from the reviewed
fresh_source_catalog_pg_test.go, not discovered from passing output:

- ReadOnly, lines 97–131: quoted false/true × seeded false/true, 4 leaves.
- ExpectedIdentity, 133–182: 9 scalar identities + 8 objects × 5 changes, 49.
- OperationalErrors, 184–241: 6 table cases + ended + SQL-aborted, 8.
- HostileShape, 243–339: 25 literal cases + 18 type/default + 7 nullable
  + 25 CHECK variants + 10 index variants + stale-OID replacement, 86.

Those line references describe PG head a114670ccb7b88a5b6ba6cff11538a538d871e34.
Its source parent is 8185fdcdda25cdaa6f4fa284c844a76bab168c5c.
Inventory changes require source review and matching negative controls.
Slash-separated t.Run labels are literal names, not invented intermediate tests.

## Execution and audit

The existing PG17 job retains full internal/domestic runs in separate ordinary
and race databases, -count=1, no -short, and only TestPGQueuePhysicalRestart
excluded. The existing five-test gate stays unchanged. Each stream must have
one package start/pass, one run/pass per observed test, all 151 fresh names
and five legacy roots, no unknown fresh child, failure, skip or unfinished test.
Parent/child and pause/continue ordering is checked; Output never counts as
execution evidence. Duplicate JSON keys at every object depth are rejected;
bare NaN/Infinity/-Infinity are rejected at every depth, but strings stay opaque.
output events require an existing string Output, never a nested event object.
Other DOM tests remain allowed and must complete normally.
Mode identity comes from the unchanged workflow invocation, not an inferred
JSON property. Streams are checked separately; concatenating them fails.

Official setup-go GOROOT/bin/gofmt checks exactly four tracked catalog Go files.
The artifact records its identity, Go version, checkout commit/tree/parents,
source hashes, formatting list/diff and both complete raw JSON streams.
if: always() retains available evidence after failures; it never overrides them.
No environment dump, database URL, credential or unrelated log is archived.
Run controls with python3 -m unittest discover -s .github/scripts
-p test_dom_fresh_catalog_gate.py -v. These are parser tests, not PG execution.

No physical restart, actual role/ACL/RLS/OWNER security-negative matrix,
independent opclass-only negative, complete fresh-chain, enrollment or production
claim follows from this gate. Those existing limitations remain explicit.
