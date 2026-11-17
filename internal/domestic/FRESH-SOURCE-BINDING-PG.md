# Fresh DOM source binding PostgreSQL verification

Test-only companion to DOM-FRESH-SOURCE-001, jointly gated with the pins suite.
Uses unchanged freshCatalogPGFixture: real reviewed 003/007 and owned schema.
Fixture identities are test expectations, never production enrollment evidence.
Startup uses the same pool variable for Binding and Hub; the existing same-pool
check is explicit. Hub fields are assigned only before any participant is used.
The real constructor runs in caller-owned Access, preserves rows/settings and
allows caller Commit. That startup transaction is not the participant lifetime.

ConstructorRejects checks real persistent wiring/catalog/profile invalid inputs.
OperationalErrors checks both methods against nil/zero/foreign/ended Access,
nil/canceled/expired context and actual SQL-aborted transactions; healthy new
transaction use must still work. Drift changes each relation's name/shape after
construction and requires all copies to retire. Rename is undone on the original
OID and complete validation succeeds before old-handle rejection is asserted.
Column removal leaves PostgreSQL dropped-column metadata and is not claimed as
an exact shape restoration. WiringReentry separately checks wallet and city after
WCB, with no reopening on restoration. Mutations are sequential, not concurrent.
CityStageDrift first establishes W, then changes checkpoint/building DEFAULTs.
PinCityState must hold exact WCB, return metadata mismatch and retire both aliases.
After restoring each original DEFAULT, full validation must succeed while every
Pin on both old aliases still refuses. This detects an omitted city validator.

The shared fixture/observers also support the separately scoped pins suite.
Both suites and source form one review/ordinary/race/CI release gate; neither
replaces the existing complete FreshCatalog matrix. All named leaves must run
and pass with zero skips/fails. Scratch Go 1.23.2 compile/pure tests do not execute
this PG matrix or establish permission-negative, restart, enrollment or deployment PASS.
