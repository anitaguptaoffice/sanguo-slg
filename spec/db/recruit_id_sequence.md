# SPEC-RECRUIT-ID — hero identity migration candidate

Based on approved contract `e36c333225265b0e90b898debacee78023528585`; publication/consumers require parent merge and orchestrator approval.
Scope: `spec/db/**` only. No runtime writer change, GRANT, deployment, or production migration.
This sequence alone does **not** fix recruit atomicity or protect heroes from old UPSERT writers.

## Ordered migration and deployment gates

`m4_005_hero_id_sequence.sql` follows `m4_004_hotel_recruit.sql` in ApplySpecs lexical order.
No hero rows/PKs/defaults/template uniqueness/old IDs change. All `server_id` shards in the **same database and application schema** share one sequence.
Separate databases/schemas do not share it: verify actual routing before release; this is not a global cross-database allocator.

Before **any** application boot that can invoke ApplySpecs, an authorized release owner must:

1. Stop/disable every creator in `recruit_atomicity.md` §6, related writes/maintenance/DDL,
   and all sequence clients; drain old processes, transactions and pooled sessions. Record proof.
   Table locks cannot prove this or stop old writers after commit.
2. Use one migration owner, READ COMMITTED and the exact application schema first in
   `search_path`. Required tables must be in that schema; migration never falls through to public.
3. Audit all retained/imported/backed-up hero identity highwaters, including deleted heroes.
   Supply their greatest known reserved ID via maintenance connection startup setting
   `sanguo.hero_id_reserved_highwater`; it is a nonnegative bigint, default 0 only when none known.
   Set it on **every** migration-pool connection, not an arbitrary pooled connection. Deleted IDs with no retained evidence cannot be proved unreused.
4. Verify migration-owner SELECT/lock/CREATE and existing-sequence SELECT/UPDATE permissions.
   Confirm application-role USAGE and correct schema resolution under the existing approved
   role policy. This migration grants nothing; missing permissions block activation, not MAX+1 fallback.
5. Verify the migration ledger, config/state, retained-reference bounds and an application-role
   nextval probe (a deliberate gap). Then deploy the complete compatible writer/content/API unit
   and its real production-adapter tests before opening writes. No mixed old/new writers.

## Reference inventory and failure behavior

Required: `player_hero.hero_id`, `hero_skill.hero_id`, `hero_assignment.hero_id`,
`field_army.hero_ids` (unnested, across every server). Sources: `005_hero.sql`, `004_military.sql`.
Optional only when present: `hero_largess_schedule`, `hero_march_force`, `hero_expr_session`
from `internal/hero/pg_store.go`, `player_hero_coming` / `player_hero_captive` from their stores.
All five contain BIGINT hero_id; missing tables are not created. `player_hero_lionize` has player/NPC keys, not hero IDs; hotel candidate_id is not hero_id.
Unexpected hero_id/hero_ids (table,column) pairs fail closed, including extra columns on known tables; audit opaque references separately (no guessed tables/JSON paths).
Unexpected source types, missing required tables, restricted row visibility or permissions fail.

Existing sequence must be permanent/logged, BIGINT, start/min 1, max 9223372036854775807,
increment/cache 1, NO CYCLE, OWNED BY NONE. Wrong objects/configs are rejected, never repaired/reset.
All sources lock before their MAX scans, without server filter. Empty `(1,false)` → first ID 1; advance only if next ID ≤ H; preserve higher state.
H=BIGINT_MAX or an exhausted called sequence aborts; H=MAX-1 permits MAX exactly once then errors.

ApplySpecs executes SQL then ledger INSERT separately. The single DO is replay-safe when the name was not recorded: same object, no lowering or reuse.
`setval` is last and only moves forward; PostgreSQL does not undo existing-sequence advancement
on transaction rollback. Gaps are intentional. Never DROP/recreate, RESTART, restore a lower
sequence snapshot or deploy MAX/UPSERT writers as rollback; keep writes closed if incompatible.
Restore sequence and data together; rerun the forward-only audit/migration under the same gates even if the old ledger says applied; preserve external highwater.
See [sequence functions](https://www.postgresql.org/docs/16/functions-sequence.html) and [CREATE SEQUENCE](https://www.postgresql.org/docs/16/sql-createsequence.html).
## Isolated validation

Run `RECRUIT_ID_TEST_DSN=<disposable-pg-dsn> python3 spec/db/tests/recruit_id.py` with psql on PATH.
With the same environment, `go run spec/db/tests/recruit_id_loader.go` tests the actual ApplySpecs
loader, deletes only the new ledger row, reruns, and proves higher sequence state survives.
The fixture uses unique schemas, ordered base DDL and actual optional Go DDL; it drops only its own schemas. It covers empty/shards/deleted/orphan references,
reserved/high-existing state, replay, rollback, limits, wrong configs and schema isolation.
Local PostgreSQL 17.6 (2026-10-25): 26 grouped checks, actual loader replay and `validate.sh` passed; PostgreSQL 16 and production roles were not tested.
This does not attest production drain, permissions, routing, backup completeness or writer safety.
