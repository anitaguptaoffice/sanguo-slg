# MIL-RETURN-CATALOG-001

Private read-only prerequisite for #2109, under adopted MIL_RETURN_CREDIT/PORTS.
`validateReturnCatalog` snapshots the profile and checks only its fixed nine-object
projection against reviewed `004_military.sql` plus `m4_009_march_identity.sql`.
Other objects are not validated. No source discovery is adopted as approval.
Nullable origin/deadline, array dimensions/default, constraints, indexes, roles and
SELECT/UPDATE privileges must match; SQL/context failures remain errors.
This is not exact23 construction, pinning, retirement, enrollment, lifecycle,
credit, readback, deployment or production readiness. Existing14 remains unchanged.
PG tests apply reviewed DDL; test-only OID refresh isolates shape drift. Catalog
flag perturbations use disposable owned PG17 and are rolled back, never production.
Run all MARCH tests ordinary and race with DATABASE_URL, zero unexpected skips;
mandatory new tests: `TestReturnCatalogInvalidAndConstants`,
`TestPGReturnCatalog{SourceAndSettings,MetadataDrift,Privileges,ReadOnly}`.

## MIL-RETURN-SOURCE-001 (#2113)
`NewReturnParticipant` privately snapshots exact23 identities and RecruitCatalog;
one shared source retains common14/new9 drift retirement across participant copies.
`Pin` copies Access, takes eight ROW EXCLUSIVE pins in adopted order, then validates
both projections, without rows, allocation or transaction end. Exhaustion is valid.
Tests: `TestReturnSourceInvalidAndCauses`, `TestPGReturnSourceProfiles`,
`TestPGReturnSourceSnapshotsAndAccess`, `TestPGReturnSourceOrderedPins`.
Eight independent blockers witness every prefix; final-stage drift and cancellation,
retained pins, independently lockable seeded rows and unchanged sequences are checked.
Official Go/PG17 ordinary/race execution remains required; no enrollment or activation.
