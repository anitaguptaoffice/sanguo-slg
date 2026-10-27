# Fresh-city military provenance marker v1

Task: SPEC-MIL-FRESH-COHORT-001 / [#1858](https://github.com/anitaguptaoffice/sanguo-slg/issues/1858).
Base main: `48f25fb91805ed74c0325f113f72c7989e975463`.
Inputs: [command boundary §6](SLG_COMMAND_BOUNDARY.md#6-新城与旧数据边界),
[recruit queue](MIL_RECRUIT_QUEUE.md), [recruit storage](MIL_RECRUIT_STORAGE.md),
[transaction lifetime](MIL_RECRUIT_TX_LIFETIME.md).

This freezes a proposed physical marker and fresh-only semantics, not executable
DDL, an implemented readiness port, target-database authorization or activation.
The current WORLD `CreateCityInTx` and DOM `Hub.CreateNewCity` are legacy inputs,
not implementations of this new exact-transaction proof chain. Do not call the
DOM transaction-owning callback API from inside an application-owned transaction.

## 1. Purpose and ownership

MIL owns a permanent `mil_city_origin` table in the captured application schema.
One marker records which authenticated owner and reviewed fresh cohort created
one exact `(server_id, city_id)` military state. It is NOT an audit certificate,
proof that arbitrary existing rows are fresh, or authority to initialize/reset.
No changes to existing `player_city`, `city_troop`, `work_queue`, origin or receipt
schemas/constraints follow from this document. No new game resource or unit.

Cohort identity is exactly16 opaque nonzero bytes, compared byte-for-byte. It is
a non-secret identifier from the separately reviewed server activation profile,
not a password, signature, capability, client field or freely chosen retry key.
The runtime must not generate a new cohort ID merely to adopt existing data or
bypass a closed epoch. Its issuer, durable provenance and through-commit fence
remain the external activation gates required by the storage contract.

## 2. Exact proposed physical shape

The later independent SQL entry must create this shape only when absent, under
its approved maintenance conditions. This is a design, not a command to run now.

| Column | Type | Nullability | Meaning |
|---|---|---|---|
| server_id | integer | NOT NULL | Positive bound shard |
| city_id | bigint | NOT NULL | Positive WORLD-created city identity |
| owner_player_id | bigint | NOT NULL | Positive authenticated creator |
| cohort_id | bytea | NOT NULL | Exactly16 bytes, not all zero |
| format_version | smallint | NOT NULL | Exactly1 |
| created_at | timestamptz | NOT NULL | Canonical creation processing instant |

Named constraints:
- `mil_city_origin_pkey`: PRIMARY KEY `(server_id, city_id)` in that order.
- `mil_city_origin_server_id_check`: `server_id > 0`.
- `mil_city_origin_city_id_check`: `city_id > 0`.
- `mil_city_origin_owner_player_id_check`: `owner_player_id > 0`.
- `mil_city_origin_cohort_id_check`: length16 and unequal to16 zero bytes.
- `mil_city_origin_format_version_check`: `format_version = 1`.
- `mil_city_origin_created_at_check`: finite instant in
  `[0001-01-01T00:00:00.000Z, 9999-12-31T23:59:59.999Z]`, with no submillisecond part.

The timestamp constraint must use explicit UTC range literals and check original
millisecond precision; it must not silently round persisted input. Use the same
canonical representation as recruit queue/receipt timestamps. A fresh processing
sample may be normalized before the insert; readback values are validated as-is.

Permanent ordinary heap table; no defaults, generated/identity columns, extra
indexes except the immediate unique B-tree primary-key index, FKs, triggers,
rules, RLS, inheritance or partitioning. No automatic ON DELETE cascade into this
record. All checks validated and enforced, not deferred or NOT VALID. The later
PG17 catalog validator must verify exact columns/types/order, checks and index
semantics against these constants, not against a mutable sibling template.

Schema/table ownership and actual application-role privileges must be checked
against the separately reviewed source profile. Do not assume current_user owns
every table. SELECT/INSERT and whatever rights the approved row-lock operation
requires must actually exist; missing rights fail closed. This document grants
no privilege, changes no role, enables no RLS and authorizes no SECURITY DEFINER.

## 3. Only actual fresh creation may mint the chain

The application owns one actual Begin and its only Commit/Rollback. Preserve the
approved ordering of actor/wallet/creation and WORLD city locks, then MIL marker
and all troop rows, then DOM initialization. The complete lock-strength order,
creation allocator and one-shot Go proof API require their own interface review
before wiring; do not reuse a late stronger actor lock from a legacy participant
as evidence that the new global order is safe.

Fixed production sequence: actual WORLD new INSERT → MIL insert/readback → DOM
initialization → sole application commit. WORLD returns a private, exact-tx,
one-shot fresh-city proof only after its actual insert succeeds. An arbitrary
CityID, same schema string, `fresh=true`, caller callback or returned integer is
not that proof. Shared proof state must make copies single-use; end/cancellation
invalidates it. MIL success must be minted only after actual writes AND readback,
not merely after consuming the WORLD proof or attempting SQL.

Before initialization, reject ANY existing marker or city_troop row for the new
city, including extra/unsupported units and apparently empty rows. Do not only
query units1–4. Reject existing city-bound work_queue history in all states/types
or retained recruit receipts for the identity. Complete cohort origin/receipt
inventory and retained city-ID non-reuse proof remain prerequisites: a missing
receipt cannot hide origin-only history or license a recycled city ID. WORLD's
legacy MAX(current city_id)+1 alone does not prove non-reuse after deletion.
The later allocator/creation contract must close this gate before activation.

For a truly new proven city, INSERT one immutable marker and exactly four troop
rows, units1–4 with ready count0 and wounded0. Use explicit values, not UPSERT,
ON CONFLICT DO NOTHING, updates, delete/reinsert, repair or adopting matching rows.
Any conflict, unexpected existing row, row-count mismatch or failed readback aborts
the entire creation transaction, including WORLD/DOM effects. No partial commit.

Read back marker scope/owner/cohort/version/time and all four actual troop rows
inside the same transaction; require exact identities and zero initial values.
DOM then initializes its own state using the validated sealed city/owner/shard,
and its returned identity must match rather than replace that source. The exact
cross-package APIs remain unfrozen here; no domain may gain Begin/Commit/raw-tx
adoption or a generic callback escape as an implementation shortcut.

Publish caches/schedulers only after confirmed commit. If a legacy DOM gate is
needed for compatibility, obtain it before DB locks and never re-enter a Hub while
holding DB locks. The migration from old creation coordination and all relevant
writers must be reviewed together. No standalone deployment of an incomplete chain.

## 4. Existing-city readiness is not initialization

For subsequent Recruit, validate authoritative WORLD owner, exact marker scope,
creator/owner, cohort and format1 plus exactly four legal stock rows in the same
approved transaction. Current ready/wounded values need only be nonnegative int32;
DO NOT require them to stay zero after legitimate recruitment. A marker is never
a reason to overwrite existing stock with the initial zeros.

Missing marker, missing/extra/negative stock, wrong owner/cohort/version, unknown
legacy work or invalid provenance means unavailable, not fresh, not empty and not
permission to initialize. Owner transfer/conquest, adoption, legacy migration and
cohort reassignment remain unsupported until separate reviewed contracts exist.
Current owner changes therefore cannot silently rebind the immutable marker.
Historical acceptance reporting still follows its separate authenticated receipt
contract and is not gated on today's city ownership merely to report an old fact.

Compatible writers must serialize on the same WORLD city lock before changing
stock or queue state. Marker/stock row locks alone cannot prevent a fifth stock
row or an incompatible old writer. Activation must inventory and fence old Hub
flushers, old recruit callbacks, march/return, GM/import, deletion/restore tools
and every other incompatible writer for the cohort. No cached valid boolean is
a substitute for that fence, its revocation interlock and complete provenance.

## 5. Immutability, retention and restore

Certified writers never UPDATE or DELETE a marker; created_at is its original
creation fact, not a last-seen/last-settled timestamp. No refresh or key reuse.
This is a certified-writer/maintenance discipline, not immunity to privileged SQL.
Retain marker, WORLD identity, DOM initialization/checkpoints, troops, queue,
command origin/receipt, retained rule artifacts and allocator/reference evidence
as a coherent recoverable cohort. Do not cascade-delete marker history with a
city or prune it while retained references/retries can still exist.

A restored marker alone cannot establish correct troops or an eligible absent
command. Partial restore, missing external evidence, lowered allocator history,
revoked/unknown epoch or deleted identity closes the cohort. Reopen only after
complete coherent audit and independently verified provenance plus continuous
through-commit fencing. If all evidence was deleted, current stock/wallet cannot
reconstruct it; do not fabricate a marker or promise otherwise.

## 6. Required follow-on implementation and evidence

1. Independent SQL/manual create-and-audit entry, plus exact PG17 metadata tests.
   Table absent/wrong/partial shape must fail as specified; no startup DDL/repair.
2. Explicit application-owned fresh-city interface contract and source/role/cohort
   binding, exact-tx proof lifetimes, actor lock strengths, retained city allocator
   inventory/non-reuse and compatible DOM staging/publication. No raw callback.
3. Separate WORLD, MIL and DOM implementations, then closed-call-graph APP wiring.
   MIL initialization and readback require real isolated PG17 evidence; this prose
   does not count as such. Source merge never approves target DDL or production.
4. Tests: true new city commits all records together; failures after WORLD, marker,
   each troop insertion/readback and DOM leave no partial creation; commit-ack loss
   stays unknown and is inspected through authoritative state, never blind retry.
5. Reject zero/foreign/copied-used/ended proof, substituted access/pool/role/schema,
   wrong owner/cohort, existing zero rows, duplicate/extra rows, missing halves,
   recycled city identity and uncertified legacy writers. Actual process restart,
   restore and invalidation-vs-commit races remain required activation evidence.

These decisions add only the specified fresh provenance marker contract. They do
not implement the full durable Recruit path, allow legacy military reconstruction,
expand DATA-002, permit paid features, release historical hold or deploy production.
