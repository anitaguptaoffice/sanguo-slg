# SPEC-HERO-METADATA — existing-shape storage prerequisite

Local independent contract candidate, not deployment or transaction-atomicity approval.
Scope: `spec/db/**`; affected follow-ons: HERO metadata supplied-tx ports and API
coming/captive/lionize coordinators, under `spec/rules/hotel_transactions.md`.
`m4_007_hero_metadata.sql` follows the separate m4_006 candidate-ID contract.
Do not rename/rewrite earlier applied migrations or substitute the design's stale m4_006 name.

## Exact shape and preservation

The audited existing DDL is from `coming_store.go`, `captive_store.go`, and
`persuade_store.go` at `799e1998d84610291b0bbcad7a108439f728ac7d`.
Tests pin those three DDL strings by SHA-256 before extracting legacy fixtures.

| Table | Columns in exact order (all NOT NULL except marked) | Primary key |
|---|---|---|
| player_hero_coming | server_id INT, hero_id BIGINT, city_id BIGINT | server_id, hero_id |
| player_hero_captive | server_id INT, hero_id BIGINT, city_id BIGINT, summon_item_cfg_id INT DEFAULT 0, summon_item_qty INT DEFAULT 0 | server_id, hero_id |
| player_hero_lionize | server_id INT, player_id BIGINT, npc_cfg_id INT, friend INT DEFAULT 0, state SMALLINT DEFAULT 0, last_persuade_at TIMESTAMPTZ NULL | server_id, player_id, npc_cfg_id |

No other defaults, constraints, identity/generated fields or indexes are introduced.
Fresh comments exactly match the audited DDL, including *legacy* status labels;
existing comments are preserved, not normalized. Existing PK names may differ:
validation requires structural key order and a valid/live/immediate unique B-tree.
Unknown extra indexes (even nonunique) require explicit separate classification;
this conservative candidate rejects them without modification. It rejects extra
columns/constraints, dropped-column residue, wrong types/defaults/nullability,
nonpermanent/non-heap/partitioned/inherited/typed objects, RLS/policies/triggers/rules,
identity/generated expressions and altered replica identity/storage options.

No rows are read for repair or changed. Repeated hero IDs across shards, orphan/high
IDs, missing metadata, nonzero/partly-zero captive requirements, out-of-range
friend/state values, and NULL/non-NULL timestamps remain unchanged. No gameplay,
fees, requirements, ownership inference, missing-row generation, FKs, cleanup,
sequence allocation/restart or old-writer repair. All identities and the existing
natural/hero/candidate highwater contracts remain independent gates.

## Provisioning, replay and read-only readiness

Run only with separate release authorization, one externally serialized migration
owner, and all affected access stopped/drained (old getters also issue lazy DDL).
Record target database/schema, definitions/rows/OIDs/ACLs/ledger and writer inventory.
Set bounded `lock_timeout` and `statement_timeout` in the authorized runner, with
READ COMMITTED. The target is `current_schema()` captured before catalog-only
search_path; system/temp namespaces are rejected. Every target lookup and DDL is
namespace-qualified; later-schema decoys are never adopted. The application schema
must be first in the effective search_path on every application connection.

One DO statement first validates and locks every existing object in coming/captive/
lionize order, then creates only absent tables and validates everything again.
Provisioning uses ACCESS EXCLUSIVE; it cannot lock absent objects or prove a drain.
No mixed-owner/concurrent-migration safety claim is made. Existing-role DML rights
are checked, but ACLs, ownership and roles are never changed. Runtime privileges
must be verified using the actual pre-provisioned runtime role before activation.

Actual ApplySpecs executes the body and ledger INSERT separately. Body failure
rolls back its creations. Completed body + failed/missing ledger safely revalidates
without rewriting tables, indexes, rows or comments. Earlier files may already have
committed, including sequence advances; this is **not** whole-ApplySpecs atomicity.
An incompatible table that blocks m4_005 cannot be repaired by m4_007.

A recorded ledger name skips the body, so it is not readiness evidence. Independently
run the same body inside a READ COMMITTED, READ ONLY transaction after setting
`SET LOCAL sanguo.hero_metadata_validate_only = 'true'`; it requires all three
objects, takes ACCESS SHARE only, never creates missing objects, then ROLLBACK.
Use explicit target search_path and bounded timeouts. Recheck after normal boot,
ledger recovery and restore/drift. Never delete production ledger rows just to test.

## Cutover, rollback and test gate

This is storage readiness only: old runtime stores still issue DDL and retain their
existing non-atomic behavior. No no-DDL/atomic runtime guarantee follows from this
migration. HERO/API family changes need independent review and coordinated cutover;
no mixed old/new writers, route removal, deployment or live migration is authorized.
Rollback retains tables/data/ledger/sequence highwater; no down migration. After
atomic activation, rollback only to compatible transaction/identity/economy writers;
keep affected writes closed if only old partial-commit code is available.

Disposable-only test: `HERO_METADATA_TEST_DSN=... go run ./spec/db/tests/hero_metadata_loader`.
Invalid/not-ready index fixtures alter only the disposable cluster's catalog flags;
foreign-object fixtures have no handler, connection or credentials.
It invokes actual ApplySpecs with ordered files, all eight legacy subsets, populated
preservation/replays, schema decoys, strict negative fixtures, post-first-create
atomic failure and separate ledger failure. It checks both ID sequences unchanged
across m4_007 and compares current validate.sh glob discovery with loader discovery.
Never run the fixed-schema destructive validate.sh against a shared database.
PostgreSQL 17.6 / Go 1.23 are the local evidence target; other versions, separately
provisioned restricted/mixed-owner roles, production drain/ACLs, and runtime
transaction behavior require further evidence, not assumed acceptance.

Readiness also compares each unqualified runtime relation to its validated target
OID using the caller's original search_path, including implicit pg_temp precedence.
Shadowing rejects the whole body, rolling back any newly provisioned objects.
The caller's search_path is restored on success. This checks this connection only;
all pooled connections must retain the reviewed schema/path and temporary-object
hygiene. It is not proof against future session changes or other connections.
