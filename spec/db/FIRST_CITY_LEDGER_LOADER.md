# WORLD first-city ledger ApplySpecs loader (SPEC-FIRST-CITY-LEDGER-LOADER-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2560](https://github.com/anitaguptaoffice/sanguo-slg/issues/2560).
Baseline at registration: draft PR [#2559](https://github.com/anitaguptaoffice/sanguo-slg/pull/2559) head
`64c49c02b0a681d60dfccc6203ee4ba35e1a4f95`.
Depends on [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md), [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md),
frozen `m4_010_first_city_ledger.sql`, `m4_011_first_city_ledger_companion.sql`, and
[hero_metadata.md](hero_metadata.md) / [recruit_storage_entry.sh](tests/recruit_storage_entry.sh) patterns.

## 1. Purpose and explicit non-goals

Freeze **ApplySpecs replay**, **missing-ledger idempotency**, and **isolated PG17 acceptance** for the
WORLD first-city ledger DDL and companion helpers. This card documents loader semantics and provides a
disposable harness; it does **not** implement runtime writers or effect/finalizer participants.

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- activate `player_city_id_seq`, live routes, or API/client product stacks;
- modify frozen `m4_010` / `m4_011` table definitions, companion conversion SQL bodies, OID inventory,
  or GLOBAL_PINS pin-order prose (except cross-links in §8 status tables elsewhere);
- implement CITY_CREATION_RECOVERY §10 item 3 phase lifecycle, DOM/APP coordination, or concurrent
  effect/finalizer race matrices beyond the minimal replay/idempotency checks here;
- claim playable first-city or real-backend product acceptance is complete.

## 2. ApplySpecs ordering (m4_010 → m4_011)

`internal/platform/db.ApplySpecs` discovers `spec/db/*.sql`, sorts **lexically**, and for each file:

1. Skips when `schema_migrations.name` already records the filename.
2. Otherwise executes the file body in one `Exec` and `INSERT`s the ledger row in a **separate** statement.

Relevant frozen filenames (must stay in this order):

| Order | File | Body scope |
|-------|------|------------|
| … | `00*.sql`, `m3_*.sql`, earlier `m4_*.sql` | Base domain DDL executed before ledger files. |
| N | `m4_010_first_city_ledger.sql` | `world_first_city_command`, `world_first_city_actor_slot`, retention triggers. |
| N+1 | `m4_011_first_city_ledger_companion.sql` | `world_first_city_slot_key_text`, `world_first_city_slot_advisory_lock` helpers. |
| N+2 | `m4_012_first_city_ledger_pending_unique_index.sql` | Partial unique index `idx_world_first_city_command_one_pending_per_slot` (see [FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md)). |

Earlier committed files (including sequence advances) are **not** rolled back when a later file fails.
Whole-ApplySpecs is therefore not one atomic transaction across all `m4_*` files.

Provisioning bodies run under **READ COMMITTED** with `search_path` pinned to `pg_catalog, pg_temp`
inside each DO block, then restored (see `m4_010` / `m4_011` headers). Application schema is
`current_schema()` captured at entry — same discipline as [FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §3.

## 3. Missing-ledger idempotency and replay

| Scenario | Expected behavior |
|----------|-------------------|
| Normal second boot | Ledger row present → **skip** body; catalog unchanged. |
| Body committed, ledger `INSERT` failed or row deleted | Body re-executes; `CREATE TABLE IF NOT EXISTS` / `CREATE OR REPLACE FUNCTION` must not create a second catalog object set, reset rows, or weaken triggers. |
| Partial ApplySpecs (e.g. `m4_010` applied, `m4_011` not) | Next boot applies only pending filenames in lexical order; `m4_011` requires `m4_010` tables to exist. |
| Runtime intake data | **Out of scope** for ApplySpecs; slot/command **rows** are never created or repaired by loader replay. |

**Conflict with existing success/rejection receipts:** ApplySpecs replays **catalog only**. It must not
`UPDATE` or `DELETE` `world_first_city_command` / `world_first_city_actor_slot` rows. Terminal transitions
remain writer-only; DDL triggers forbid reversing `durable_state` 2/3 or mutating immutable intake fields
([FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §6). Replaying loader SQL must not “re-apply” business effects
or alter receipt columns.

**Duplicate slot/command prevention at runtime** (documented for loader reviewers, enforced by DDL + writers,
not by ApplySpecs): at most one slot PK per `(realm_id, server_id, player_id)`; command PK uniqueness;
no second intake catalog object from loader replay.

## 4. Wire / companion alignment

Loader acceptance assumes frozen wire and DDL from #2553–#2559 stacks. No new proto fields or
`durable_state` values. Companion SQL in [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md)
remains reference-only for runtime; this card does not execute intake/effect/finalizer transactions in CI
beyond helper existence checks.

## 5. Isolated PG17 acceptance

Disposable-only:

```bash
export FIRST_CITY_LEDGER_TEST_DSN='postgres://.../disposable_db_only'
export ALLOW_OWNED_PG17_TEST=1
go run ./spec/db/tests/first_city_ledger_loader
```

Requirements:
- DSN must name an **explicitly disposable** cluster (never shared/production).
- `ALLOW_OWNED_PG17_TEST=1` opt-in (same family as `mil_city_origin_entry.sh`).
- Harness uses **actual** `ApplySpecs` against a temp copy of ordered `spec/db/*.sql` matching `validate.sh` globs.
- Asserts: first apply creates ledger objects; second apply is no-op; missing `schema_migrations` row for
  `m4_010` / `m4_011` replays idempotently; terminal `durable_state` cannot be reversed; companion functions exist.
- Skipped when DSN unset (local agents without PG must not fake pass).

Record PostgreSQL `SHOW server_version` in harness output. Core effect/finalizer terminal races are
frozen in [FIRST_CITY_LEDGER_RACE.md](FIRST_CITY_LEDGER_RACE.md); full §4.2 business-path contention in
[FIRST_CITY_LEDGER_EFFECT_PATH.md](FIRST_CITY_LEDGER_EFFECT_PATH.md). Restricted-role ACL suites are **not** frozen here (see §7).

Ordinary vs race CI: repository `api-pg-test` jobs (ordinary / race) exercise platform DB code paths;
this card's loader is additionally gated on the disposable PG17 harness above.

## 6. Validation (syntax compose)

```bash
./spec/db/validate.sh
```

Confirms all `00*.sql` / `m3_*.sql` / `m4_*.sql` files, including `m4_010` and `m4_011`, still compose in
disposable `spec_db_validate`. That is **syntax/order** evidence, not missing-ledger replay proof.

## 7. Follow-on work explicitly not frozen here

| Item | Status |
|------|--------|
| Concurrent effect vs finalizer PG17 race harness (companion §5.3 core matrix) | Frozen in [FIRST_CITY_LEDGER_RACE.md](FIRST_CITY_LEDGER_RACE.md); full wallet/MIL/DOM contention still open |
| `player_city_id_seq` reviewed activation | WORLD_CITY_IDENTITY gate |
| Read-only `validate_only` GUC body | Frozen in [FIRST_CITY_LEDGER_VALIDATE_ONLY.md](FIRST_CITY_LEDGER_VALIDATE_ONLY.md) (`m4_013_first_city_ledger_validate_only.sql`) |
| Target realm drain/fence/deploy execution | Not authorized |
| Runtime MIL/DOM `LOCK TABLE` executable wiring | Implementation cards |

## 8. Operator notes

- One externally serialized migration owner for production ApplySpecs; drain ledger writers before replay
  on a shared schema (same as hero_metadata.md).
- Rollback retains tables, triggers, functions, ledger rows, and any intake data; no down migration.
- Merging this SPEC does **not** authorize cutover, realm certification, or playable-first-city completion.
