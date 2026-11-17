# API-RETURN-SOURCE-PG-001

Task [#2136](https://github.com/anitaguptaoffice/sanguo-slg/issues/2136), source dependency [#2135](https://github.com/anitaguptaoffice/sanguo-slg/issues/2135).
New tests only; no production enrollment, coordinator activation, repair or migration.

Each case creates its own quoted schema, pool and independent observer connection.
The fixture executes original 001/002/003/004 and m4_008 SQL, both manual 008/010
entries with host `psql -X -v ON_ERROR_STOP=1`, then m4_009. No ApplySpecs/template DDL.
`player_city_id_seq` uses the exact reviewed WORLD test-only bigint sequence DDL;
there is no claim of an adopted WORLD provisioning migration. Other baseline tables stay.
The independently enumerated 43-object profile is not a count of all schema objects.

Coverage: real four-domain constructors, captured caller profile scalars/map and
binding/catalog wrappers, complete bundle after confirmed rollback, one-shot copies,
wrong OID/owner and DDL-valid default drift in each domain, no partial bundle.
Recorded backend SQL requires one Begin, one Rollback, no Commit/allocation, and the
12 pins (ACCOUNT 2, DOM 1, WORLD 1, MIL 8). Independent ACCESS EXCLUSIVE NOWAIT locks
check release; observer snapshots cover every baseline table's rows/xmin/ctid and
all sequence rows. Config modifiers and tracer helpers are test-only, never APP hooks.

Pending verification: official Go formatting/compile and real PG17 full API ordinary
and race runs, without `-short`, preserving original 225 plus all new top-level tests.
Local Go/gofmt/psql are unavailable or invalid; no runtime pass is claimed here.
[#2137](https://github.com/anitaguptaoffice/sanguo-slg/issues/2137) owns actual blocked
prefix/cancel/panic/cleanup uncertainty. Optional `t.Log` branches do not prove full
coverage; same-process recreation is not process-death recovery. Keep all gates open.
