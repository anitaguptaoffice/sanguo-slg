# Retained WORLD city identity allocation

Task: SPEC-WORLD-CITY-ID-001 / [#1862](https://github.com/anitaguptaoffice/sanguo-slg/issues/1862).
Base main: `d52153f72aff84c3df586e8ebb79277e90f2918b`.
Inputs: [fresh cohort](MIL_FRESH_COHORT.md),
[application boundary](SLG_COMMAND_BOUNDARY.md),
[recruit storage and retention](MIL_RECRUIT_STORAGE.md).

This freezes the selected forward-only city allocator contract. It does not
execute DDL, implement allocation, approve a target database or enable a cohort.
WORLD's current `CreateCityInTx` uses MAX(current city_id)+1. That implementation
is not retained non-reuse evidence after deletion and is NOT silently upgraded
by this document. Legacy city identities and existing rows are never renumbered.

## 1. Identity domain and exact proposed sequence

Keep city identity scoped as `(server_id, city_id)`. Historical duplicate numeric
city IDs across shards remain legal and unchanged. New certified creation uses
one schema-global `player_city_id_seq` across shards, rather than one sequence per
request/player/shard or one mutable in-memory counter. The broader allocation
namespace does not remove shard checks from reads, locks, proofs or foreign data.

WORLD owns the allocator semantics. The later independent manual SQL entry must
provision/validate precisely:
- permanent ordinary sequence in the captured application schema;
- `AS bigint`, START1, MINVALUE1, MAXVALUE9223372036854775807;
- INCREMENT1, CACHE1, NO CYCLE, OWNED BY NONE;
- no table default, identity column, automatic schema creation or helper grant.

Positive signed-int64 is the existing WORLD CityID domain; this does not widen
its protocol or claim arbitrary client numeric encodings preserve every int64.
Transport adaptation and numeric rendering remain independently constrained.
Validate positive ID and range before every insert/result. No wrap, truncation,
saturation, reset or fallback to MAX+1. Exhaustion means unavailable.

Schema/sequence ownership, OIDs, database, runtime role and actual sequence access
must match the separately approved source profile. A matching name or DSN is not
identity. Do not grant USAGE/SELECT, alter owners, change roles or fabricate a
profile when binding fails. Maintenance-role success does not prove app rights.

## 2. Complete retained highwater inventory

Before provisioning/advancing, independently verify a complete owner-reviewed
reference inventory and external monotonic evidence for the application scope.
Let H be the greatest positively allocated city ID retained or externally known,
across ALL included shards and lifecycle states. H is0 only when complete verified
history establishes that no city identity was ever allocated in that cohort of
source history. An empty table or missing migration ledger cannot establish this.

The inventory must at least address these known reference locations:
- `player_city.city_id`, including every shard and owner;
- immutable `mil_city_origin.city_id` and all retained `mil_recruit_receipt.city_id`;
- `city_troop.city_id`, `city_building.city_id`, `city_production_checkpoint.city_id`;
- non-null `work_queue.city_id` in every queue type/status, not just pending jobs;
- HERO `hero_assignment.target_id` when assign_type1 means city, but not army
  targets merely because they share the same numeric SQL type;
- HERO coming/captive city references and any owner-declared retained history;
- context-dependent report/JSON/external references under their actual owner
  contract, plus retained allocator observations and coherent restore evidence.

This list is a minimum review checklist, NOT an executable complete inventory.
A column name match is not a semantic city reference. For example, mixed NPC /
player-city report fields require owner classification. Conversely, do not omit
real references merely because they live in an unlisted table or JSON field.
Each included location needs its exact relation/field/predicate, namespace, legal
null/sentinel rules, retention policy and source of completeness. Do not assume
zero/negative values are harmless sentinels without that owner's contract.

Missing expected tables, unclassified values/states/references, partial pages,
unknown external history, inconsistent snapshots or invalid identities close the
allocator gate. Do not replace missing evidence with0, derive history from current
wallet/stock, or scan only visible active cities. A declared external maximum is
accepted only with independently verified provenance, not a request parameter or
cached boolean. If all identity evidence was deleted, non-reuse cannot be recovered
from remaining rows; fail closed rather than promise an impossible reconstruction.

## 3. Maintenance fence and next-value semantics

A reviewed external drain/fence must cover EVERY relevant allocator, city writer,
retention/deletion/restore operation and concurrent DDL before the inventory and
sequence advance. Row/table locks do not fence standalone nextval/setval or old
application counters. Quiesce connections with any retained allocation state;
CACHE1 is not a replacement for draining writers or proving coherent history.
Use bounded maintenance timeouts and re-audit when the fence's validity is uncertain.

For validated sequence state `(last_value=L, is_called=C)`, the next candidate is
L when C=false, otherwise L+1. Treat C=true and L=MaxInt64 as exhausted WITHOUT
performing overflowing addition. For every other state, require next>H before
releasing the fence. Sequence gaps and abandoned/rolled-back IDs are allowed.

If H=MaxInt64, no next identity exists: fail before changing state. If an existing
next candidate is already greater than H, preserve the greater sequence state,
including its is_called semantics. If next<=H and H<MaxInt64, the permitted
forward advance is setval(H,true), yielding H+1 next. Never call setval(0,...).
For independently verified genuinely empty history, a new sequence starts at
L=1,C=false so its first allocation is1. Do not reset an existing sequence to that
state simply because the current tables are empty.

setval/nextval effects can survive transaction rollback. Failed maintenance must
not lower or recreate the sequence as compensation, and repeated maintenance must
preserve any greater state. Document what completed and keep the cohort closed
until validation succeeds. A migration filename/ledger proves neither the current
object shape nor last_value/history; explicit current validation is mandatory.

Existing wrong-kind, wrong-owner, wrong-property or missing-after-restore objects
are unavailable, not automatically dropped/recreated/adopted. First-install create
and existing-object audit/advance must have distinct reviewed preconditions.
If restore lowered or erased allocator evidence, only a complete coherent audit
with independently retained monotonic evidence may authorize forward recovery.
No runtime startup or business command executes this maintenance path.

## 4. Runtime allocation and writer composition

Only the concrete bound WORLD fresh-city participant allocates within the
application-owned transaction and frozen creation lock order. Production entry
accepts no arbitrary CityID, raw sequence name, raw tx, allocator callback or
caller-supplied success proof. Use the exact active transaction capability and
schema-qualified captured sequence. Revalidate its OID/properties/source/role and
valid cohort fence, not a newly discovered same-name object. Quote schema names
as identifiers; namespace catalog lookup must preserve literal mixed case/quotes.

Allocate only after authoritative actor/wallet/creation serialization prerequisites
and before the actual WORLD INSERT. A returned nextval is not a created city.
Only successful actual insert may mint the one-shot fresh-city proof consumed by
MIL and then DOM under their separate interface contract. Rollback abandons the
allocated number; never return it to a pool or retry with a stale cached CityID.
Commit uncertainty follows authoritative recovery, not blind new-ID creation.

All writers affecting this identity domain must be inventoried and compatible
before activation. Old MAX+1 creators, direct supplied-ID imports/GM tools and
other allocators are fenced until separately reviewed to use the same mechanism
or prove a safe non-overlapping domain. Do not assume old per-shard advisory locks
alone synchronize with an independent sequence or its maintenance. No mixed-writer
rollout based solely on one successful isolated test. Include rollback binaries
in the inventory; rollback must not reintroduce an incompatible allocator.

Runtime metadata checks cannot defeat an out-of-band privileged setval or deletion.
Continuous certified-writer/retention/DDL fencing and revocation interlock through
commit remain mandatory, with complete re-audit before reopening an uncertain
source. This is not a privilege sandbox against a malicious DBA or same-process Go.

## 5. Required follow-on source and evidence

Independent SQL/manual entries and PG17 tests must cover empty/retained/orphan
reference cases, false/true is_called, preserved ahead state, checked MaxInt64
boundary, repeated execution, rollback after advancement and missing/wrong/partial
objects. Do not count a skipped database test as actual evidence.

The concrete owner-reviewed reference inventory, row-lock/allocator lock ordering,
source/profile/role checks and exact fresh-city Go proof API require their own
bounded contracts/implementations. This document does not invent missing meanings
for legacy tables or supply an issuer's provenance certificate.

Runtime acceptance requires actual two-creator concurrency without duplicate
accepted identities, source/role/OID drift rejection, rollback gaps, no post-end
allocation, retention after city deletion, coherent restore and invalidation races.
WORLD/MIL/DOM/APP must review the complete composition before activation. No target
DDL, grants, production deployment, DATA-003, paid expansion or historical hold
release follows from source approval or this contract.
