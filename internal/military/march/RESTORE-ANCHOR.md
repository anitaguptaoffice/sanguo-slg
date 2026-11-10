# MIL-RESTORE-ANCHOR-001

The dormant `MarchRestore` port now validates the retained army owner before
ignoring terminal orders. `march_order.army_id` resolves through the shard-scoped
LEFT JOIN to `field_army.owner_player_id`; a missing army or nonpositive owner
rejects the whole snapshot with `ErrMarchRestore`. No bindings, release list,
Hub state or staged events escape the rejected validation.

This implements the retained ownership and missing-army quarantine requirements
in [MARCH_PERSISTENCE](../../../spec/rules/MARCH_PERSISTENCE.md). Terminal history
is still not replayed. It can have no surviving troops, and its heroes may already
be idle or claimed by a newer live army. Live army status compatibility is unchanged.
This is not a full terminal graph, source-catalog or retention audit.

## Verification

Before the production edit, `TestMarchRestoreRetainedAnchor` failed exactly the
three terminal missing/zero/negative owner cases on main `3b499057`; the three
live rejection cases and two terminal/reuse controls passed. The old valid-plan
fixture now includes its retained owner and army status instead of blessing a
missing army.

`TestPGMarchRestoreRetainedAnchor` exercises the public restore port using real
committed rows and a fresh, independently identified PostgreSQL connection whose
search path is `pg_catalog`. Eight cases cover missing/cross-shard armies,
zero/negative owners, retained survivors, annihilation, idle and reused heroes.
Failure returns no result or Hub publication, cannot activate, and leaves the
same Hub available for retry after test-owned fixture repair. Valid history has
exactly four live bindings/events and never schedules the terminal order.
Every read compares all five source tables including `xmin`/`ctid` and all three
allocator states. Fixture repair is test-only, not a new production facility.

Run official Go 1.23 formatting, vet and ordinary/race tests. Actual PG acceptance
requires an owned PostgreSQL 17 `DATABASE_URL` and `psql`:

    go test ./internal/military/march -count=1 -json
    go test ./internal/military/march -race -count=1 -json

Existing normal PR CI runs both full package modes with real PG and rejects every
skip/failure. Review raw output for both new roots and all sixteen leaf cases;
the eight PG evidence lines must execute in each mode. Local database skips are
not PG acceptance. Preserve all existing tests and required workflows.

## Boundaries

No database write, schema change, API/HERO wiring, activation, automatic repair,
deployment or held arrival-source adoption. Startup restore/readiness, durable
dispatch/credit, orphan release/retry, unknown outcomes and complete gameplay
restart acceptance remain separate blocked work. Connection recreation here is
not a physical database or complete application restart test.
