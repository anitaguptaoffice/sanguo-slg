# WORLD first-city ledger one-PENDING partial unique index (SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced, deployed or production-enabled.
Task: [#2672](https://github.com/anitaguptaoffice/sanguo-slg/issues/2672). Stacks on draft PR [#2671](https://github.com/anitaguptaoffice/sanguo-slg/pull/2671).

Depends on [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2/§4/§6,
[`m4_010_first_city_ledger.sql`](m4_010_first_city_ledger.sql),
[FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md),
[FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md).
Intake/ledger directory evidence only; no wallet/CITY/MIL/DOM effect rows; `player_city_id_seq` not activated.

## 1. Index shape (frozen)

| Property | Value |
|----------|-------|
| Relation | `world_first_city_command` |
| Index name | `idx_world_first_city_command_one_pending_per_slot` |
| Uniqueness | `UNIQUE` partial index |
| Key columns | `(realm_id, server_id, player_id)` — actor slot key; **excludes** `command_id` |
| Predicate | `WHERE durable_state = 1` (wire **PENDING** only) |
| Idempotent apply | `CREATE UNIQUE INDEX IF NOT EXISTS` in `m4_012_first_city_ledger_pending_unique_index.sql` |

Canonical DDL (application schema `%schema%`):

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_world_first_city_command_one_pending_per_slot
    ON %schema%.world_first_city_command (realm_id, server_id, player_id)
    WHERE durable_state = 1;
```

`durable_state` values remain **1=PENDING, 2=SUCCEEDED, 3=REJECTED_NO_EFFECT** per `m4_010` and FIRST-CITY-WIRE; this card adds **no** wire fields or new state codes.

## 2. Role and boundaries

- **Catalog backstop:** at most one open PENDING row per actor slot in the directory. It does **not** replace
  [FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md) intake linearization, `world_first_city_slot_advisory_lock`,
  head CAS, or `m4_010` retention/terminal triggers.
- **PK scope unchanged:** primary key remains `(realm_id, server_id, player_id, command_id)`; multiple terminal
  rows (2/3) may coexist per slot; they are **outside** the partial unique predicate.
- **`ID_CONTENT_CONFLICT` / `HEAD_CONFLICT`:** unchanged. A second INSERT with a new `command_id` that would leave two
  PENDING rows on the same slot fails with unique violation **23505** once this index exists—writers may still rely on CAS first.
- **Cross-actor `command_id` string:** full PK scope; same UUID string on different `(realm_id, server_id, player_id)` tuples
  does not share this partial key (per [FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md) §Boundaries).
- **Post-terminal PENDING:** whether product rules allow a **new** PENDING intake after `SUCCEEDED` or `REJECTED_NO_EFFECT` is
  **not** decided here; terminal rows do not occupy the partial unique key. See
  [FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md](FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md) for OID §6 row 12 scope.

## 3. ApplySpecs ordering

Lexical order after frozen companions:

| Order | File | Body |
|-------|------|------|
| N | `m4_010_first_city_ledger.sql` | Table + triggers (unchanged by this card) |
| N+1 | `m4_011_first_city_ledger_companion.sql` | Slot helpers (unchanged) |
| N+2 | `m4_012_first_city_ledger_pending_unique_index.sql` | Partial unique index only |

Replay: second ApplySpecs pass skips when `schema_migrations` already records `m4_012_first_city_ledger_pending_unique_index.sql`;
`IF NOT EXISTS` keeps the index definition idempotent.

## 4. Explicit non-goals

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- implement runtime/API/client writers, ACL, `validate_only` GUC, or `player_city_id_seq` activation;
- change `m4_010` / `m4_011` table, constraint, trigger or companion function bodies;
- claim playable first-city or real-backend product acceptance is complete.

## 5. Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_pending_unique_index
```

Without `ALLOW_OWNED_PG17_TEST=1` or `FIRST_CITY_LEDGER_TEST_DSN`, the harness prints `SKIP` and exits 0.

Harness records PostgreSQL `server_version` and row-level evidence for: duplicate PENDING same slot (incl. concurrent INSERT),
independent PENDING per distinct slot, terminal (2/3) rows not counting toward the partial key, cross-actor shared `command_id` string.

## Follow-on (separate SPEC cards)

ACL, crash barriers, `validate_only` GUC, `player_city_id_seq`, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence
(remainder of [FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md) Follow-on after this item).
