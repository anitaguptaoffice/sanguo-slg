# Manual fresh-city marker entries

SPEC-MIL-CITY-ORIGIN-ENTRY-001 / #1860; contract: [fresh cohort](../../rules/MIL_FRESH_COHORT.md).
These psql files are outside the top-level ApplySpecs SQL enumeration. They do
not run at startup, create marker rows, initialize troops or activate a cohort.

Run only in a fresh maintenance session against an independently verified and
separately authorized database/schema, with reviewed release files and a writer /
DDL drain. Never infer target approval from a successful CI run or this README.
Pass the exact trusted application schema explicitly; no default target:

    psql -X -v city_origin_schema=YOUR_VERIFIED_SCHEMA -f 010_create_mil_city_origin.psql
    psql -X -v city_origin_schema=YOUR_VERIFIED_SCHEMA -f 011_audit_mil_city_origin.psql

Create requires absent marker; audit requires existing marker and never repairs.
Paths inside wrappers use relative-to-file inclusion, independent of working dir.
Each wrapper owns its transaction and catalog-first resolution settings; UTC and
ISO rendering make metadata comparisons deterministic. Settings are LOCAL and
restored on commit/rollback. Never include wrappers in an existing transaction.
Audit takes SHARE lock for stable metadata, does not change business rows, and is
not an audit of cohort contents, restore history, city allocator or writer fences.
The helper is not a standalone runtime binding or an automatic migration.

Guard uses fixed PG17 column/constraint/index constants, never a mutable sibling
reference table. Wrong/partial shape fails closed. No grants, owner changes,
RLS/trigger disabling, SECURITY DEFINER or fallback creation. Observed owner/OID
and maintenance role are diagnostic only; actual application-role privileges,
source profile, coherent provenance and through-commit fence remain separate.
No marker rows can be adopted/backfilled by these entries. Production stays off.

The test script is ONLY for a newly owned disposable PG17 database, with explicit
ALLOW_OWNED_PG17_TEST=1 and already supplied connection environment. It creates
and removes its own named fixture schemas, never touches shared/real databases,
and never changes roles/privileges/security settings. A failing test is not a pass.
