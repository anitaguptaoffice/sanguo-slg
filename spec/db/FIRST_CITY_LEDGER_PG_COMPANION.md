# WORLD first-city ledger PG companion SQL (SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced or production-enabled.
Task: [#2558](https://github.com/anitaguptaoffice/sanguo-slg/issues/2558).
Baseline at registration: draft PR [#2557](https://github.com/anitaguptaoffice/sanguo-slg/pull/2557) head
`848ec0c648c35976579a2f92b9c9f978129e1756`.
Depends on [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md), [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md),
[FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md), frozen `m4_010_first_city_ledger.sql`,
`001_account.sql`–`004_military.sql`, [FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §4,
[FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md).

## 1. Purpose and explicit non-goals

Freeze **reviewed participant SQL** for three transaction classes bound to
`world_first_city_command` / `world_first_city_actor_slot`: **intake**, **effect/continue**, and
**narrow rejection finalizer**. Companion SQL follows global pin order
**ACCOUNT → slot/command → wallet → CITY/map → MIL/DOM** ([GLOBAL_PINS](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §2).

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- modify `m4_010_first_city_ledger.sql` table definitions, proto field numbers or wire shapes;
- implement Go/runtime writers, ApplySpecs loader, isolated PG17 race harness, or `player_city_id_seq` activation;
- implement CITY_CREATION_RECOVERY §10 item 3 private finalizer / phase lifecycle beyond narrow SQL here;
- authorize legacy CreateCity / lawful multi-city semantics outside the first-city slot namespace.

Pure helpers in `m4_011_first_city_ledger_companion.sql` exist for `validate.sh` syntax only; they perform no IO.

## 2. Shared parameters and helpers

Bind these logical parameters from APP admission (not from client-mutable request bodies alone):

| Symbol | Type | Source |
|--------|------|--------|
| `p_realm_id` | `UUID` | enrollment profile |
| `p_server_id` | `INT` | trusted shard |
| `p_player_id` | `BIGINT` | authenticated actor |
| `p_command_id` | `UUID` | stable command identity |
| `p_account_id` | `BIGINT` | session account |
| `p_x`, `p_y` | `INT` | from immutable `canonical_c1` decode (writer-owned) |

**Slot advisory key** (GLOBAL_PINS §3; helper in `m4_011`):

```sql
SELECT world_first_city_slot_advisory_lock(p_realm_id, p_server_id, p_player_id);
-- equivalent: pg_advisory_xact_lock(hashtextextended(slot_key_text, 0))
```

**Relation pins** — see §3–§5 per class. Qualify relations with the reviewed `application_schema`.

## 3. Intake participant (PENDING + slot head only)

**Commits:** one `world_first_city_command` row `durable_state = 1` and optional `head_command_id` advance.
**Forbidden:** any `player_wallet`, `player_city`, `map_cell` business `FOR UPDATE`, MIL/DOM `INSERT`, wallet/CITY §4.1 pins (steps 3–6).

### 3.1 Sequence (single transaction)

```sql
-- §4.1 pins: steps 1–2 only
LOCK TABLE account, player IN ROW SHARE MODE;
LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE;

-- Step 1 ACCOUNT (GLOBAL_PINS §4.2)
SELECT status FROM account WHERE account_id = p_account_id FOR SHARE;  -- abort unless status = 1
SELECT account_id FROM player WHERE server_id = p_server_id AND player_id = p_player_id FOR SHARE;
-- abort unless account_id = p_account_id

-- Step 2 slot/command (FIRST_CITY_LEDGER.md §4)
SELECT world_first_city_slot_advisory_lock(p_realm_id, p_server_id, p_player_id);
INSERT INTO world_first_city_actor_slot (realm_id, server_id, player_id, account_id, head_command_id)
VALUES (p_realm_id, p_server_id, p_player_id, p_account_id, NULL)
ON CONFLICT (realm_id, server_id, player_id) DO NOTHING;
SELECT head_command_id, account_id
  FROM world_first_city_actor_slot
 WHERE realm_id = p_realm_id AND server_id = p_server_id AND player_id = p_player_id
   FOR UPDATE;
-- CAS: enforce predecessor / EMPTY rules; abort HEAD_CONFLICT or ID_CONTENT_CONFLICT

INSERT INTO world_first_city_command (
    realm_id, server_id, player_id, command_id, account_id,
    canonical_c1, durable_state, template_version, rules_version, catalog_version,
    content_encoding_version, template_fct1, content_sha256, received_at
) VALUES (
    p_realm_id, p_server_id, p_player_id, p_command_id, p_account_id,
    :canonical_c1, 1, :template_version, :rules_version, :catalog_version,
    :content_encoding_version, :template_fct1, :content_sha256, :received_at
);
-- ON unique (realm_id, server_id, player_id, command_id): same C1 → read-only return; different C1 → conflict, no UPDATE

UPDATE world_first_city_actor_slot
   SET head_command_id = p_command_id
 WHERE realm_id = p_realm_id AND server_id = p_server_id AND player_id = p_player_id
   AND (head_command_id IS NULL OR head_command_id = :expected_predecessor);
-- abort if no row updated when CAS required
COMMIT;
```

**Abort semantics:** roll back entire transaction; no partial head without command or vice versa. Losers of competing INITIAL intake must not enter effect paths.

## 4. Effect / continue participant (business + success receipt)

**Commits:** fresh-city INSERT/updates on wallet/CITY/MIL/DOM **and** terminal success receipt on the **same**
`world_first_city_command` PK (`durable_state = 2`, receipt columns per DDL checks).
**Required:** full §4.1 relation pins (steps 1–6) before wallet row locks (GLOBAL_PINS §4.1).

### 4.1 Pin and lock sequence

```sql
LOCK TABLE account, player IN ROW SHARE MODE;
LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE;
LOCK TABLE player_wallet IN ROW EXCLUSIVE MODE;
LOCK TABLE map_cell IN ROW SHARE MODE;
LOCK TABLE player_city IN ROW EXCLUSIVE MODE;
-- MIL/DOM: lock reviewed relations per GLOBAL_PINS §4.1 step 5–6 when present in schema
-- (mil_city_origin, city_troop, work_queue, mil_recruit_origin, mil_recruit_receipt,
--  city_production_checkpoint, city_building)

SELECT status FROM account WHERE account_id = p_account_id FOR SHARE;
SELECT account_id FROM player WHERE server_id = p_server_id AND player_id = p_player_id FOR SHARE;

SELECT world_first_city_slot_advisory_lock(p_realm_id, p_server_id, p_player_id);
SELECT head_command_id FROM world_first_city_actor_slot
 WHERE realm_id = p_realm_id AND server_id = p_server_id AND player_id = p_player_id
   FOR UPDATE;

SELECT durable_state, canonical_c1, account_id, template_version, rules_version,
       catalog_version, content_encoding_version, template_fct1, content_sha256
  FROM world_first_city_command
 WHERE realm_id = p_realm_id AND server_id = p_server_id
   AND player_id = p_player_id AND command_id = p_command_id
   FOR UPDATE;
-- abort unless durable_state = 1 and intake bytes match admission generation
```

### 4.2 Business stages (after command PENDING re-read)

Follow [FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §4 business order inside this transaction:

1. **Wallet:** preserve-or-insert `player_wallet`, then `SELECT … FOR UPDATE` on `(server_id, player_id)`.
2. **CITY/map:** `pg_advisory_xact_lock(1128879193, p_server_id)` (`0x43495459`, `CITY` per GLOBAL_PINS §4.5); `map_cell` `FOR UPDATE` at `(p_server_id, p_x, p_y)`; validate buildable terrain.
3. **Allocate `city_id`** via reviewed retained-safe sequence (not MAX+1; activation not authorized here).
4. **`INSERT player_city`**; read back sealed identity (`is_capital`, `wall_level`, `morale`, coordinates).
5. **MIL** marker + zero `city_troop` per fresh cohort contract.
6. **DOM** `city_production_checkpoint` + `city_building` for new `city_id`.

### 4.3 Terminal success (same transaction, after §6.2 re-reads)

Immediately before `UPDATE` to `durable_state = 2`, re-read slot head, command `durable_state`, locked wallet/map/city/MIL/DOM evidence per GLOBAL_PINS §6.1–§6.2. Abort (roll back **all** business writes) if any row fails.

```sql
UPDATE world_first_city_command
   SET durable_state = 2,
       terminal_at = :terminal_at,
       success_city_id = :allocated_city_id,
       success_server_id = p_server_id,
       success_player_id = p_player_id,
       success_is_capital = true,
       success_wall_level = 1,
       success_morale = 100
 WHERE realm_id = p_realm_id AND server_id = p_server_id
   AND player_id = p_player_id AND command_id = p_command_id
   AND durable_state = 1;
-- abort unless exactly one row updated; COMMIT only after this UPDATE succeeds
COMMIT;
```

**Invariant:** no `COMMIT` that persists `player_city` (or wallet/MIL/DOM effects) without the matching success receipt `UPDATE` on the same command PK in the same transaction.

## 5. Narrow rejection finalizer (`durable_state = 3` only)

**Commits:** terminal rejection receipt only (`rejection_reason IN (1, 2)` per wire).
**Forbidden:** `INSERT`/`UPDATE` on `player_wallet`, `player_city`, MIL/DOM init; §4.1 relation pins steps 3–6; wallet or city business `FOR UPDATE`.

### 5.1 Finalizer lock modes (companion resolves GLOBAL_PINS §6.3)

| Evidence | Relation | Lock mode | Rationale |
|----------|----------|-----------|-----------|
| Terrain (reason `1`) | `map_cell` at C1 coordinates | **`SELECT … FOR SHARE`** | Read-only buildability; no `ROW EXCLUSIVE` pin on `player_city` / wallet path; does not serialize competing effect `FOR UPDATE` on the same cell beyond SHARE/UPDATE interaction |
| Coordinate (reason `2`) | `player_city` at `(server_id, x, y)` | **`SELECT … FOR SHARE`** on matching row, or absent row | Proves committed occupier without acquiring effect-stage city row exclusive locks or step 4 relation pins |
| Command terminality | `world_first_city_command` | **`FOR UPDATE`** (held from step 2) | Serializes with concurrent effect on same PK |
| Slot head | `world_first_city_actor_slot` | **`FOR UPDATE`** (held from step 2) | Matches effect/finalizer re-entry |

Finalizer **must not** `LOCK TABLE player_wallet`, `map_cell`/`player_city` at §4.1 steps 3–4 pin modes, or MIL/DOM tables for relation pins.

### 5.2 Sequence

```sql
LOCK TABLE account, player IN ROW SHARE MODE;
LOCK TABLE world_first_city_actor_slot, world_first_city_command IN ROW EXCLUSIVE MODE;

SELECT status FROM account WHERE account_id = p_account_id FOR SHARE;
SELECT account_id FROM player WHERE server_id = p_server_id AND player_id = p_player_id FOR SHARE;

SELECT world_first_city_slot_advisory_lock(p_realm_id, p_server_id, p_player_id);
SELECT head_command_id FROM world_first_city_actor_slot
 WHERE realm_id = p_realm_id AND server_id = p_server_id AND player_id = p_player_id
   FOR UPDATE;

SELECT durable_state, canonical_c1
  FROM world_first_city_command
 WHERE realm_id = p_realm_id AND server_id = p_server_id
   AND player_id = p_player_id AND command_id = p_command_id
   FOR UPDATE;
-- abort unless durable_state = 1

-- Re-read whitelist evidence (no wallet/MIL/DOM writes)
SELECT terrain FROM map_cell
 WHERE server_id = p_server_id AND x = p_x AND y = p_y
   FOR SHARE;  -- reason 1: still non-buildable

SELECT city_id FROM player_city
 WHERE server_id = p_server_id AND x = p_x AND y = p_y
   FOR SHARE;  -- reason 2: committed occupier exists (non-null row)

-- §6.1 common re-read: head_command_id = p_command_id; account binding unchanged

UPDATE world_first_city_command
   SET durable_state = 3,
       terminal_at = :terminal_at,
       rejection_reason = :rejection_reason  -- 1 or 2 only
 WHERE realm_id = p_realm_id AND server_id = p_server_id
   AND player_id = p_player_id AND command_id = p_command_id
   AND durable_state = 1;
COMMIT;
```

### 5.3 Concurrency with effect

Both classes hold **slot advisory + slot `FOR UPDATE` + command `FOR UPDATE`** before terminal `UPDATE`. A finalizer must not `COMMIT` `durable_state = 3` while another transaction holds the same command row locked for effect unless that holder has aborted. An effect must not `COMMIT` business effects without success receipt if command is no longer `durable_state = 1`. **Do not** infer outcome from SQL error codes alone (GLOBAL_PINS §6).

## 6. Wire, DDL and follow-on gaps

- Terminal shapes and `rejection_reason` 1/2 match `m4_010_first_city_ledger.sql` and FIRST-CITY-WIRE.md; no new wire fields.
- Canonical C1 coordinate extraction and FCT1-driven wallet/building INSERT literals remain on implementation cards; companion states **where** they run (effect txn only).
- **Not frozen here:** SPEC-FIRST-CITY-LEDGER-LOADER-001 (ApplySpecs replay / PG17 isolation); reviewed `player_city_id_seq` activation; full CITY_CREATION_RECOVERY §10 item 3 phase lifecycle; target realm drain/fence execution.

## 7. Validation

```bash
./spec/db/validate.sh
```

Confirms `m4_010` + `m4_011` companion helpers compose in disposable `spec_db_validate`. Loader and concurrent effect/finalizer race tests belong to LOADER / implementation cards.
