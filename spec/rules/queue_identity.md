# SPEC-QUEUE-ID — existing work_queue identity

Review prerequisite only, not runtime activation or military durability. Based on
`203300fa3f34dba19d7cc914a6a8c75c5dc2d852`. No new queue type, troop/NPC/hero state,
payload, gameplay, wallet, timing, or checkpoint contract is introduced here.

## Identity and consumers

- `003_domestic.sql` keeps PK `(server_id,queue_id)`, not a city-local PK.
  DOM's per-city `++nextJobID` can collide between cities on one shard.
- One `work_queue_id_seq` serves every new persisted queue producer in the same
  application schema/database, across cities, shards and queue types. Permanent
  logged bigint, START/MIN 1, INCREMENT/CACHE 1, MAX **9007199254740991**, NO CYCLE,
  OWNED BY NONE. The ceiling preserves existing JavaScript safe-integer decoding.
- IDs are not authorization, city routing, timestamps or gapless counters. Gaps
  from failure/rollback are harmless; exhausted/unavailable/unauthorized/incorrect
  allocators fail closed. No MAX+1, fallback counter, huge offset or ID rewriting.
- Separate DOM implementation allocates with schema-qualified `nextval` **only
  for NEW persisted build jobs**, before accepted publication and atomic with the
  existing debit/job persistence boundary. Sequence reservation itself survives
  rollback. Flush, load, retry of the same persisted job, completion and restart
  must keep its ID/times; an uncertain commit is not permission to allocate again.
- Retain DOM's type-1 pending-row load/delete filters; do not rewrite or delete
  another type or retained terminal identity. Later reviewed producers must use
  this same allocator; this contract does not enable production/recruit queues.
- Startup binds schema/shard and verifies source/sequence metadata and role
  access without CREATE/ALTER. Runtime performs no provisioning or repair. A
  separately authorized maintenance migration is not a runtime fallback.

## Maintenance / retained namespace / restore

1. Stop admission and drain/fence every old build producer, snapshot flusher,
   callback and allocator client sharing this schema, plus maintenance and DDL.
   Serialize one owner-run migration. Table locks alone do not establish the fence.
2. Inventory every surviving row (all types/statuses/shards), live memory job,
   retained import/export/reservation and still-actionable reference. Preserve IDs
   and document which old sessions/callbacks/client references are retired versus
   retained. Unknown live/retained identity blocks cutover. Do **not** demand an
   unknowable all-time deleted maximum when no replay/reference remains valid.
3. Supply the greatest retained identity outside work_queue through
   `sanguo.queue_id_retained_highwater` on **every** maintenance-pool connection;
   nonnegative integer <= the ceiling. Default 0 means documented absence of such
   identities, not an inference from empty SQL rows. No arbitrary offset.
4. Application schema must be current_schema and owned by the migration role;
   default public may instead belong to pg_database_owner only when current_user
   is the actual current database owner. Superuser/membership alone is insufficient.
   work_queue and any existing sequence must still belong directly to that role.
   Trusted catalog lookup places pg_catalog before explicit pg_temp, including
   catalog-named temp decoys. Require the exact reviewed columns,
   defaults and immediate PK, permanent heap without RLS/inheritance/rules/triggers;
   no adoption of objects from a later schema or pg_temp shadow. Existing index
   names/nonunique ancillary indexes are not identity. Unexpected queue_id/queue_ids
   columns in this schema fail pending review; audit opaque/cross-schema references
   separately. This SQL is not proof that the inventory or writer fence is complete.
5. Run `spec/db/m4_008_work_queue_id_sequence.sql` at READ COMMITTED before an
   ApplySpecs-capable upgraded boot; it grants nothing and changes no queue row.
   Release owner must separately verify exact runtime schema resolution and role
   SELECT/USAGE access (nextval probe consumes a harmless ID) under approved policy.
6. H=max(all retained rows, supplied retained highwater). First fresh ID=1; otherwise
   allocation exceeds H and preserves higher existing called/uncalled state. Invalid
   legacy IDs fail without rewriting. H=ceiling aborts; H=ceiling-1 allows ceiling
   once, then errors. Wrong shape/config/ownership is not silently repaired.
7. ApplySpecs ledger is separate: missing-ledger replay preserves sequence identity
   and never lowers it. setval runs last after validation; rollback can retain an
   advance. Never reset/recreate/lower to roll back. Restore data, sequence and
   retained-reference evidence together; rerun the forward-only audit even with an
   existing ledger. A lowered restored snapshot/unknown retained state is not safe.
8. Separate reviewed DOM activation requires two-city concurrent uniqueness,
   flush/reload ID stability, empty-queue restart nonreuse, no foreign-type deletion,
   debit/publication failure safety and verified old-writer fence. No live/native
   process restart or military initialization is authorized by this prerequisite.
