# WORLD first-city ledger OID/profile and writer inventory (SPEC-FIRST-CITY-LEDGER-OID-PROFILE-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced or production-enabled.
Task: [#2554](https://github.com/anitaguptaoffice/sanguo-slg/issues/2554).
Baseline at registration: draft PR [#2553](https://github.com/anitaguptaoffice/sanguo-slg/pull/2553) head
`bfa32bbf2a54751f2b1cd58aabe39d9c492de1e7`.
Depends on merged [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §9–10 item 2,
[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §8 item 1 (this file), frozen
`m4_010_first_city_ledger.sql`, [FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md),
[WORLD_CITY_IDENTITY.md](../rules/WORLD_CITY_IDENTITY.md), [FRESH_CITY_PROOF.md](../rules/FRESH_CITY_PROOF.md),
[FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md), and `002_world.sql`.

## 1. Purpose and explicit non-goals

Freeze the **minimum enrollment record** a reviewed operator must capture and keep current
before any target realm may adopt the WORLD first-city ledger: stable logical `realm_id` to
physical PostgreSQL placement, shard/actor namespaces, cross-domain authority surfaces,
shared allocators, account-binding evidence, and a complete writer inventory with ACL and
through-commit fencing obligations aligned with CITY_CREATION_RECOVERY §9.

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- modify `m4_010_first_city_ledger.sql`, `002_world.sql`, proto field numbers or wire shapes;
- freeze PG companion SQL, ApplySpecs loader or runtime writers (global pin order frozen in
  [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md); FIRST_CITY_LEDGER.md §8 items 3–4 remain separate);
- grant mixed old/new writer operation or legacy adoption of retained ledger rows;
- substitute table locks, profile checks or process-local drain counters for external
  through-commit drain (§5).

**`002_world.sql` has no `realm` column.** Ledger `realm_id` is a logical enrollment UUID;
it does **not** create database/schema fencing. Shared `player_city`, coordinates, wallet,
MIL/DOM satellites and city/queue allocators in the same cluster remain one physical
authority boundary until independently fenced (§4–5).

## 2. Stable realm physical mapping (required enrollment fields)

Before activation, an authorized release owner must record a **realm enrollment profile** that
binds one stable logical `realm_id` (wire/discovery namespace) to every object below. The
profile is versioned, human-reviewed, and retained with the cutover audit trail; guessing
from environment names or connection URLs is insufficient.

| Field | Must identify |
|-------|----------------|
| `cluster` | Exact PostgreSQL cluster instance (host/port or cloud resource id) holding all WORLD first-city ledger rows for this realm. |
| `database` | Single database name; cross-database ledger placement is out of scope for v1. |
| `application_schema` | Captured `current_schema()` for ledger provisioning (`m4_010` DO block) and all runtime writers; must be first in effective `search_path` on every application connection (same discipline as `hero_metadata.md`). |
| `ledger_relations` | Namespace-qualified OIDs (or stable catalog fingerprint) for `world_first_city_command` and `world_first_city_actor_slot` after provisioning. |
| `shard_scope` | Which `server_id` values participate in this realm; ledger PK includes `server_id` per FIRST-CITY-WIRE.md. |
| `actor_domain` | The retained slot key `(realm_id, server_id, player_id)` and immutable `account_id` on each command row; ACCOUNT remains sole account/player binding authority (`001_account.sql`). |
| `world_city_surface` | Same-schema `player_city`, `map_cell` coordinate uniqueness `(server_id, x, y)`, and any future reviewed `player_city_id_seq` per WORLD_CITY_IDENTITY (not MAX+1). |
| `domestic_wallet_surface` | Same-schema `player_wallet`, `city_building`, `city_production_checkpoint`, and work-queue relations that key on `city_id` when effect transactions run. |
| `military_surface` | Same-schema `mil_city_origin`, troop/inventory tables and march/work-queue identity sequences touched by fresh-city effect transactions per FRESH_CITY_PARTICIPANTS. |
| `account_binding_surface` | `player (server_id, player_id) ↔ account_id` authority used at intake and effect; drift closes the path (CITY_CREATION_RECOVERY §2). |
| `allocator_authority` | Reviewed city-id sequence object (future gate) and any queue/recruit sequences that must stay coherent with retained ledger highwater across restore. |
| `writer_roles` | Distinct PostgreSQL roles for provisioning, migration, runtime APP/WORLD/ACCOUNT writers, maintenance, and read-only discovery; observed grants only, this card changes no ACL. |
| `migration_ledger` | ApplySpecs migration name recorded when `m4_010` body completed (`sanguo_migrations` pattern used elsewhere); body vs ledger are not one atomic unit. |

No target realm is certified by this document or by merge of this PR.

## 3. Mapping continuity evidence (“still valid” obligations)

The enrollment profile is not a one-time form. Operators must retain **continuously checkable**
evidence that the mapping still describes the live system:

1. **Catalog match:** Qualified `pg_class` / `pg_namespace` lookups show ledger tables still
   under the recorded `application_schema` OIDs; no rename, `ALTER ... SET SCHEMA`, partition
   move or replacement table shadowing the ledger.
2. **search_path hygiene:** Sampled application pool connections report the reviewed schema first;
   no implicit `public` or `pg_temp` shadowing of ledger or `player_city` relations (pattern:
   `hero_metadata.md` OID shadow check at connection scope).
3. **Shard binding:** Configured `server_id` routing for API/WORLD bindings matches profile
   `shard_scope`; no realm string wired to a different physical database without a new profile.
4. **Account binding integrity:** Independent read of `player` rows for enrolled shards shows no
   undrained account rebinding that would invalidate retained `world_first_city_command.account_id`.
5. **Allocator highwater:** Retained city/queue sequence observations (per WORLD_CITY_IDENTITY
   inventory) are not lower than post-restore business highwater; partial restore without ledger
   fails closed (CITY_CREATION_RECOVERY §9).
6. **Retention bundle:** Backup/restore provenance covers ledger, account, WORLD city, wallet,
   MIL/DOM and allocator state together; digest-only or empty-table checks are insufficient.
7. **Fence registry:** Documented list of excluded writers (§6) with dated drain proof remains
   current; any new writer class triggers profile revision before mixed operation.

Stale or contradictory evidence blocks activation and blocks extending an existing fence.

## 4. Authority relationships (read-only contract)

| Domain | Authority retained | First-city ledger interaction |
|--------|-------------------|------------------------------|
| ACCOUNT | `player` / account binding, ActorGuard semantics | Intake verifies `account_id` on command rows; WORLD does not rebind accounts. |
| WORLD | Slot/command lineage, head, immutable C1/FCT1, receipts in `m4_010` tables | Owns ledger DDL surface; effect path `player_city` / map pins frozen in [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §4. |
| APP/API | Orchestration, source admission, Binding, generation | Begins transactions; does not substitute for ACCOUNT/WORLD SQL authority. |
| DOM | Wallet init, buildings, checkpoint | Consumes exact FreshCity identity after WORLD INSERT; no ledger overwrite. |
| MIL | Markers, troops, inventories | Consumes allocated `city_id`; no MAX+1 path when reviewed allocator is active. |
| PLATFORM | Narrow PG mechanisms (advisory locks, sequences) | Does not interpret realm strings or cut over routes. |

Global pin order **ACCOUNT → slot/command → wallet → CITY/map → MIL/DOM** is frozen in
[FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md) (SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001).

## 5. Pre-activation ACL, drain and fencing (mandatory obligations)

Enabling the ledger route on a shared cluster requires **all** of the following before any
mixed or production intake:

1. **External through-commit drain** covering every writer in §6 through the last transaction
   that could still commit on shared relations (ledger, `player_city`, wallet, MIL/DOM,
   allocators). Evidence must include connection/session inventory and commit completion, not
   only `pg_terminate_backend` attempts.
2. **No substitute fences:** `SELECT FOR UPDATE`, advisory locks documented in FIRST_CITY_LEDGER.md §4,
   enrollment profile field presence, or in-process drain/lease counters **do not** replace (1).
3. **Whole-boundary fence:** When ledger shares storage with legacy CreateCity, coordinates,
   `player_id` ownership, or city/queue allocators, **all** incompatible writers are excluded
   together. Isolating only `world_first_city_*` labels while legacy MAX+1 or GM import continues
   on the same `player_city` is forbidden.
4. **DDL serialization:** At most one authorized migration owner applies `m4_010` or dependent
   follow-ons; concurrent DDL from old stores or manual scripts is an inventory violation.
5. **Role separation:** Provisioning superuser or migration owner credentials must not remain
   on runtime pool roles; runtime grants are verified, not widened, by this card.
6. **Rollback binary:** Deployed rollback artifacts must not reintroduce writers that ignore
   retained ledger rows or reuse command IDs.

Failure of any obligation keeps the path **closed**; partial drain is not partial enablement.

## 6. Writer and maintenance path inventory (minimum §9 coverage)

Each row must appear in the realm enrollment audit with drain/fence status before cutover.
“Absent in this deployment” still requires explicit negative evidence, not omission.

| # | Path | Shared surfaces | Drain/fence notes |
|---|------|-----------------|-------------------|
| 1 | Legacy WORLD `CreateCityInTx` / MAX+1 (`internal/world/city_creation.go`) | `player_city`, coordinates | Must be fully stopped; MAX+1 incompatible with reviewed allocator + ledger receipts. |
| 2 | DOM `saveCityWithWorld` / API `CreateNewCity` chain | Orchestrates (1) | Stop at API/DOM entry; table locks alone insufficient. |
| 3 | GM / import / batch SQL tools | `player_city`, wallet, MIL | Explicit maintenance role drain; no parallel import during fence. |
| 4 | Direct SQL / psql / DBA sessions | All shared tables + sequences | Session inventory + `pg_stat_activity` through-commit proof. |
| 5 | Snapshot flusher / async persistence workers | Wallet, city rows, caches | Stop flushers that can write city or wallet without ledger awareness. |
| 6 | Backup restore / retention jobs | Full retention bundle (§3.6) | Restore must not lower allocator or drop ledger; jobs fenced during cutover window. |
| 7 | DDL: ApplySpecs, manual migrations, lazy store DDL (`hero_metadata` pattern) | Catalog, sequences | Single migration owner; idle lazy DDL from old getters must be disabled. |
| 8 | Standalone `nextval` / `setval` / sequence repair | City/queue sequences | WORLD_CITY_IDENTITY: no uncordinated sequence advance during fence. |
| 9 | Stale pooled connections / old binaries | Any shared relation | Pool recycle + version check; old rollback binary in §5.6. |
| 10 | Background writers (queues, mail, rank, chat, unrelated domains) | Same DB/schema if co-located | Classify by actual DSN + schema; fence if they touch shared `server_id` keys or city_id. |
| 11 | Rollback / prior release binaries | City create paths | Must not restore pre-ledger semantics on the same authority boundary. |
| 12 | **New** ledger intake/effect/finalizer (post follow-on cards) | `world_first_city_*` + effect relations | Not authorized until this inventory and §5 obligations are satisfied for the target profile. |

Compatibility claims require **whole-stack** review (CITY_CREATION_RECOVERY §9); matching one
lock between old and new writers is not a compatibility proof.

## 7. Wire and DDL alignment

- Command scope, `durable_state` 1/2/3, rejection reasons 1/2, success receipt constants
  (`is_capital=true`, `wall_level=1`, `morale=100`), and immutable C1 constraints match
  `m4_010_first_city_ledger.sql` and FIRST-CITY-WIRE.md; this file adds **no** wire fields.
- UNKNOWN / NOT_OBSERVED remain non-stored transport labels (FIRST_CITY_LEDGER.md §2).
- SUCCESS receipt columns remain on the command PK row; cross-relation atomicity is still a
  companion card (§8 item 3).

## 8. Follow-on cards explicitly not frozen here

| Card | Status |
|------|--------|
| SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001 | Frozen in [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md). |
| SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001 | Effect/finalizer SQL companions — **not done**. |
| SPEC-FIRST-CITY-LEDGER-LOADER-001 | ApplySpecs replay / PG17 acceptance — **not done**. |
| Reviewed `player_city_id_seq` activation | WORLD_CITY_IDENTITY gate — **not done**. |
| Target realm enrollment execution | Drain/fence/deploy — **not authorized** by #2554. |

Do not treat OID profile documentation as completion of those gates.

## 9. Validation

```bash
./spec/db/validate.sh
```

This card adds documentation only; validation confirms `m4_010_first_city_ledger.sql` still
composes with base `00*.sql` / `m3_*.sql` / `m4_*.sql` in disposable `spec_db_validate`.
Loader/isolated PG17 acceptance belongs to SPEC-FIRST-CITY-LEDGER-LOADER-001.

## 10. Operator enrollment template (fill at cutover review)

```text
realm_id: <uuid>
profile_version: <semver or review id>
cluster / database / application_schema: <exact strings>
ledger_oids: world_first_city_command=<oid>, world_first_city_actor_slot=<oid>
shard_scope: server_id in (...)

drain_evidence_ref: <ticket, timestamp, session list hash>
fence_start_utc / fence_end_utc: ...
writer_inventory_rows: 1–12 status (stopped / absent-evidenced / blocked)
mapping_continuity_checks: 1–7 last_verified_utc
reviewer_signoff: <human, not agent self-review>
```

Incomplete templates block enablement; merging this SPEC does not populate them.
