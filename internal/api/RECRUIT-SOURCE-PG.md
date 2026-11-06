# API-RECRUIT-SOURCE-PG-001

Task [#2157](https://github.com/anitaguptaoffice/sanguo-slg/issues/2157), source dependency [#2155](https://github.com/anitaguptaoffice/sanguo-slg/issues/2155).
Basic tests only; no production enrollment, route, activation, repair or migration.

`recruitPGFixture` reuses `returnPGFixture` solely for isolated quoted-schema
bootstrap, original migrations, seed rows, pool and independent observer. Neither
helper constructs a return generation. The original 001/002/003/004 and m4_008 SQL,
host psql manual 008/010 entries and m4_009 run unchanged. WORLD sequence DDL stays
the reviewed test-only definition, not an adopted production migration. The wrapper
requires PostgreSQL major 17, discards the 43-object return profile, and separately
queries its independent PORTS inventory: ACCOUNT11 + DOM2 + WORLD7 + MIL14 = 34.
These fixture observations establish no production approval or shared-cohort source.
Optional pool-config callbacks pass through only to the test fixture, allowing
separate lifetime cases to configure connections/tracers without production hooks.

Four PG top-level tests cover actual source initialization, complete concrete Recruit
bundle, caller profile/map and Binding/catalog-wrapper replacement, all four current
catalog rules, one-shot copies, 12 domain OID/owner/shape mismatches, nine database/
schema/role expectation mismatches, and nil/zero catalog rejection before Begin.
No roles, privileges or permissions are changed. SQL records require one Begin,
one Rollback, independent backend, no commit/allocation/business-write/row-lock SQL,
and nine relation pins on success (zero on constructor mismatch). Separate real
pin-order/barrier tests are still mandatory. An observer obtains ACCESS EXCLUSIVE
NOWAIT locks after cleanup and compares every table's rows/xmin/ctid and every
sequence's explicit `jsonb_build_array(t.last_value,t.log_cnt,t.is_called)` snapshot
through the unchanged `returnPGSnapshot` helper. Never serialize a whole sequence
row as a composite: PG17 rejects it with SQLSTATE 42809.
The closed SQL allowlist freezes 15 distinct SHA-256 digests for the 16 reviewed
catalog read sites at source d4ec3d7 (ACCOUNT/MIL headers are identical), plus exact
quoted captured-schema sequence read, nine pins, Begin and Rollback. No SQL prefix
or runtime-discovered query is trusted. A separate unit test rejects writable CTEs,
all row-lock modes, allocation, wrong identifiers and appended/multiple statements.
Catalog changes require independently reviewing and updating the frozen digests.

Tests-first checkpoint precedes importing the source. No executed behavioral red,
compile, formatting, PG or race result is claimed from this executor. Required:
official Go formatting/build, actual owned PG17 normal/race, all five new top-level
tests and 23 subtests with zero unintended skips, applicable complete package tests,
exact-source/combined independent review, final-head CI and main push verification.

Separate registered work must establish pin order/modes under real blockers,
Begin/rollback uncertainty, cancellation/panic, copied Access lifetime and drain.
These remain #2155 merge gates. Common-generation admission across Recruit/return,
real V2 wire/caller journal, writer fences and production activation remain future
integration gates. Two private sources are not one enrolled generation.
