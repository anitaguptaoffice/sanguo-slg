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

Official setup-go GOROOT/bin/gofmt checks four tracked catalog Go files and
five explicitly listed lifecycle Go files, all recorded in the same manifest.
The artifact records its identity, Go version, checkout commit/tree/parents,
source hashes, formatting list/diff and both complete raw JSON streams.
if: always() retains available evidence after failures; it never overrides them.
No environment dump, database URL, credential or unrelated log is archived.
Run controls with python3 -m unittest discover -s .github/scripts
-p test_dom_fresh_catalog_gate.py -v. These are parser tests, not PG execution.

No physical restart, actual role/ACL/RLS/OWNER security-negative matrix,
independent opclass-only negative, complete fresh-chain, enrollment or production
claim follows from this gate. Those existing limitations remain explicit.

## Fresh source lifecycle extension

The source/PG matrix is the complete reviewed candidate for #2446/#2447/#2448.
The five new formatter paths are fresh_source.go, fresh_template.go,
fresh_source_test.go, fresh_source_binding_pg_test.go and
fresh_source_pins_pg_test.go, all under internal/domestic. The same official
GOROOT formatter now checks nine explicit paths. The exact five artifact members
remain unchanged; identity.txt now includes the five new paths and their hashes.
This is new-head evidence, not reuse of a catalog-only formatter manifest.

SOURCE_HASHES pins all five reviewed byte sequences. Every ordinary/race CLI
invocation first verifies those source bytes in its own checkout. The formatter
identity also requires tracked, clean index/worktree bytes and records the full
checkout commit/tree/parents. Review all nine identities with both complete raw
streams from that same job. Source or test-name changes require renewed source
and combination review, updated pins/inventory, and new-head ordinary/race logs.
A hash match alone is not execution evidence; missing sources or names fail.

The fixed binding file has ConstructorRejects 9 leaves, OperationalErrors 8,
Drift 3 relations x 2 changes, WiringReentry 2, and CityStageDrift 2: five roots
plus 27 leaves. The fixed pins file has BindingReadOnly 2, Order 8 masks x 2
segments plus 4 modes, BlockedPins 4, and ConcurrentTransactions with no children:
four roots plus 26 leaves. Together they require exactly 62 named PG tests.
The source unit file adds six roots plus eight WiringRetiresAliases children.
SOURCE_FAMILIES is the reviewed set, not names discovered from a successful log.
All 76 names require exactly one run/pass; every unknown TestPGFreshSource or
TestFreshSource root/descendant fails. The old catalog 151-name set and five
legacy roots remain mandatory. All existing JSON/state/Output/zero-test guards
apply unchanged to both matrices and every other observed DOM test.

Parser/identity unit controls use synthetic events and fixture bytes only.
They are not PG acceptance. Official Go 1.23.12 / PG17 full ordinary/race raw
execution, independent source/combined review, all required final-head CI and
post-main checks remain mandatory. Default builds are unchanged; a local
buildvcs=false result never substitutes for the normal official checkout build.

The numeric parser also rejects syntactically valid floats that overflow to
infinity, including nested fields; finite floats and Output strings stay valid.
Child run/continue events require every observed ancestor to be running, never
paused or passed. Literal slash labels do not create imaginary intermediate tests.
Formatter identity captures GOROOT, commit, tree and raw commit header with
separate checked commands. It validates commit/tree/parent hashes, checks the
header tree against the resolved tree, and uses that captured commit for source
diffs and tree records. Parent identities come from raw headers even in shallow
checkouts; unavailable parent objects do not require extra fetches or permissions.
These V2 controls correct reproduced V1 failures; the prior artifacts remain intact.

The identity audit requires exactly nine unique tracked paths and exact 100644
blob records from the captured commit. It recomputes each Git blob ID and SHA256
from the actual regular, non-executable, non-symlink file, then compares complete
record sets. Missing, duplicate, extra, malformed, wrong-path or stale records
fail even when a producer command exits zero. Verified records stay in identity.txt;
no artifact member is added. This proves source-record consistency, not test
execution authenticity, which still requires actual-job and raw-event review.

The full raw commit object is hash-checked against the captured commit, preserving
all bytes including trailing newlines. This binds its tree and parent header to
that identity, rejecting successful-but-truncated output. The temporary raw object
is not an additional artifact member or an execution claim.
