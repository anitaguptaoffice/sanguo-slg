# WORLD first-city ledger global pin order (SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001)

Registered contract; **not** adopted, wired, realm-enrolled, drained, fenced or production-enabled.
Task: [#2556](https://github.com/anitaguptaoffice/sanguo-slg/issues/2556).
Baseline at registration: draft PR [#2555](https://github.com/anitaguptaoffice/sanguo-slg/pull/2555) head
`97a3c04d15576e6713d2fd6d842f4463eaa1a367`.
Depends on merged [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §5–6 and §10 item 2,
[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4–§5,
[FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §4,
[FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §4 (reviewed relation names),
frozen `m4_010_first_city_ledger.sql`, `001_account.sql`, `002_world.sql`, `003_domestic.sql`,
`004_military.sql`, and [FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md).

## 1. Purpose and explicit non-goals

Freeze the **global lock and pin sequence** that every reviewed WORLD first-city ledger writer
must obey for **intake**, **effect/continue**, and **narrow rejection finalizer** transactions.
The mandatory total order is:

**ACCOUNT → slot/command → wallet → CITY/map → MIL/DOM**

For each step this document names concrete reviewed relations, lock types (`pg_advisory_xact_lock`,
`LOCK TABLE … MODE`, `SELECT … FOR SHARE` / `FOR UPDATE`), hold intervals until `COMMIT`/`ROLLBACK`,
and **conflict re-read evidence** required immediately before any terminal `durable_state` transition
on `world_first_city_command`.

This card does **not**:
- certify, enroll, cut over, drain, fence, deploy or enable any production realm;
- modify `m4_010_first_city_ledger.sql`, `001_account.sql`, `002_world.sql`, proto field numbers or wire shapes;
- implement runtime writers, PG companion SQL, ApplySpecs loader, or `player_city_id_seq` activation;
- authorize legacy `CreateCityInTx` / MAX+1 or change lawful multi-city semantics outside first-city slot rules;
- treat relation pins as substitute for external through-commit drain (OID profile §5).

Physical proof of missing-row slot CAS remains in [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4; this
file extends that proof into the full cross-domain order without rewriting DDL.

## 2. Transaction classes

| Class | Commits | Steps 3–5 (wallet → CITY/map → MIL/DOM) |
|-------|---------|----------------------------------------|
| **Intake** | PENDING command + slot head move only | **Forbidden** — no wallet, city, MIL, DOM writes, no city/queue `nextval`. |
| **Effect / continue** | Full fresh-city business + success receipt (`durable_state=2`) | **Required** in frozen order after slot re-lock. |
| **Narrow rejection finalizer** | `durable_state=3` only (reason 1/2) | **Forbidden** — no wallet grant, no `player_city` INSERT, no MIL/DOM init. |

**Relation pins (`LOCK TABLE` / transaction-held OID pins, §4.1):** **intake** and **narrow rejection
finalizer** must pin only ACCOUNT + ledger relations (§4.1 steps 1–2) before business locks — same pin
subset, not the full effect table. **Effect/continue** must acquire the full §4.1 pin order. Finalizer
does not take wallet, map/city, MIL, or DOM relation pins even when §6.3 re-reads terrain or coordinate
evidence (`map_cell` / `player_city` **`FOR SHARE`** per [companion §5.1](FIRST_CITY_LEDGER_PG_COMPANION.md#51-finalizer-lock-modes-companion-resolves-global_pins-63); not §4.1 steps 3–6).

All classes: **READ COMMITTED** minimum unless a later card proves a stronger isolation for a whole effect
transaction ([FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §5). Hold every lock acquired in a step until the
transaction ends; no lock downgrade or out-of-order release.

## 3. Canonical slot advisory key (step 2, intake and all classes)

Missing-row `SELECT FOR UPDATE` on `world_first_city_actor_slot` does **not** serialize peers
([FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4). Before any slot tuple lock, derive a stable text key:

```text
slot_key_text := realm_id::text || U&'\001F' || server_id::text || U&'\001F' || player_id::text
```

Acquire and hold until transaction end:

```sql
SELECT pg_advisory_xact_lock(hashtextextended(slot_key_text, 0));
```

One advisory xact lock per `(realm_id, server_id, player_id)` actor. It covers intake create-if-absent,
competing INITIAL proposals, and effect/finalizer re-entry on the same slot. **Never** infer EMPTY head or
winner identity from transient absence under READ COMMITTED while another transaction holds this lock.

## 4. Global pin and business-lock sequence

### 4.1 Relation pins

Before business row locks, each participant acquires **transaction-held relation pins** on reviewed OIDs
in this order (pattern: [FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §4).
**Intake** and **narrow rejection finalizer** pin only steps 1–2 (ACCOUNT + ledger). **Effect/continue**
must pin the full table below before any §4.3 wallet lock.

| Order | Domain | Relations (schema-qualified, reviewed release) | Pin mode |
|------:|--------|--------------------------------------------------|----------|
| 1 | ACCOUNT | `account`, `player` | `ROW SHARE` |
| 2 | WORLD ledger | `world_first_city_actor_slot`, `world_first_city_command` | `ROW EXCLUSIVE` |
| 3 | DOM | `player_wallet` | `ROW EXCLUSIVE` |
| 4 | WORLD map/city | `map_cell`, `player_city` | `map_cell` `ROW SHARE`; `player_city` `ROW EXCLUSIVE` |
| 5 | MIL | `mil_city_origin`, `city_troop`, `work_queue`; `mil_recruit_origin`, `mil_recruit_receipt` | first three `ROW EXCLUSIVE`; recruit pair `ACCESS SHARE` |
| 6 | DOM | `city_production_checkpoint`, `city_building` | `ROW EXCLUSIVE` |

Revalidate OID/shape after pins; abort if enrollment profile objects drift ([FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) §3).
Pins do not replace external DDL/fence or sequence `setval` exclusion.

### 4.2 Business locks — step 1: ACCOUNT

| Relation | Lock | Hold from | Through |
|----------|------|-----------|---------|
| `account` (`001_account.sql`) | `SELECT … FOR SHARE` on authenticated `account_id` | Credential re-check | `COMMIT`/`ROLLBACK` |
| `player` | `SELECT … FOR SHARE` on exact `(server_id, player_id)` | Binding verify `account_id` | `COMMIT`/`ROLLBACK` |

Verify `account.status = 1` and `player.account_id` equals the authenticated account. Do **not** upgrade
`player` to `FOR UPDATE` after wallet locks (same discipline as fresh-city §4).

**Intake/effect/finalizer:** always step 1.

### 4.3 Business locks — step 2: slot/command

| Relation | Lock | Hold from | Through |
|----------|------|-----------|---------|
| (advisory) | `pg_advisory_xact_lock(hashtextextended(slot_key_text, 0))` | First slot touch in txn | `COMMIT`/`ROLLBACK` |
| `world_first_city_actor_slot` | `INSERT … ON CONFLICT DO NOTHING` then `SELECT … FOR UPDATE` | After advisory (§3) | `COMMIT`/`ROLLBACK` |
| `world_first_city_command` | `INSERT` (intake) or `SELECT … FOR UPDATE` on command PK (effect/finalizer) | Same txn after slot row locked | `COMMIT`/`ROLLBACK` |

**Intake:** after slot row lock, re-read `head_command_id`, enforce predecessor/C1 rules
([FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §3–§6), `INSERT` command `durable_state=1`, `UPDATE` head when CAS passes.

**Effect/continue:** re-lock slot; `FOR UPDATE` the retained PENDING command row by `(realm_id, server_id, player_id, command_id)`;
confirm `durable_state=1` and immutable `canonical_c1` before any wallet or map lock.

**Finalizer:** same slot + command row locks; no head advance beyond terminal transition rules in §6.

Slot/command locks **precede** any `player_wallet` or `map_cell` lock on every path that touches ledger tables.

### 4.4 Business locks — step 3: wallet

| Relation | Lock | Hold from | Through |
|----------|------|-----------|---------|
| `player_wallet` (`003_domestic.sql`) | Preserve-or-insert then `SELECT … FOR UPDATE` on `(server_id, player_id)` | After step 2 complete | `COMMIT`/`ROLLBACK` |

Apply [FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §4 wallet rules: never overwrite an
existing wallet from template; first init only when preserved actor/wallet history proves eligibility.
A missing wallet row is **not** authorization to fund. Intake transactions **must not** enter step 3.

### 4.5 Business locks — step 4: CITY/map

| Relation | Lock | Hold from | Through |
|----------|------|-----------|---------|
| (advisory) | `pg_advisory_xact_lock(0x43495459, server_id)` — shard creation lock | Before map row lock | `COMMIT`/`ROLLBACK` |
| `map_cell` | `SELECT … FOR UPDATE` on `(server_id, x, y)` from immutable C1 | After shard advisory | `COMMIT`/`ROLLBACK` |
| `player_city` | Coordinate uniqueness via `map_cell` + `FOR UPDATE` on target cell; `INSERT` after reviewed allocator | After terrain validation | `COMMIT`/`ROLLBACK` |

Validate in-bounds buildable terrain per rejection reason 1. Competing actors on one cell serialize on that
`map_cell` row; `UNIQUE (server_id, x, y)` on `player_city` remains final defense for reason 2.

Allocate `city_id` only via a **reviewed retained-safe sequence** ([WORLD_CITY_IDENTITY.md](../rules/WORLD_CITY_IDENTITY.md));
**never MAX+1**. Unreviewed `player_city_id_seq` activation is **not** authorized by this card.

Intake and rejection finalizer **must not** enter step 4.

### 4.6 Business locks — step 5: MIL/DOM

| Relation | Lock / write | Hold from | Through |
|----------|--------------|-----------|---------|
| `mil_city_origin` | `INSERT` + readback after sealed `player_city` identity | After step 4 INSERT succeeds | `COMMIT`/`ROLLBACK` |
| `city_troop` | zero-stock init per fresh cohort | Same | `COMMIT`/`ROLLBACK` |
| `work_queue` | no fresh-city queue jobs on this path unless a future card says otherwise | Same | `COMMIT`/`ROLLBACK` |
| `city_production_checkpoint` | `INSERT` with single processing-time sample | After MIL marker | `COMMIT`/`ROLLBACK` |
| `city_building` | template buildings for new `city_id` | Same | `COMMIT`/`ROLLBACK` |

Reject pre-existing domestic or military rows for the allocated `city_id` rather than adopt or repair.
Effect transaction must still update success receipt columns on the **same** `world_first_city_command` PK in this
transaction (companion card binds SQL; pin order here does not imply companion is merged).

Intake and rejection finalizer **must not** enter step 5.

## 5. Per-class lock hold summary

```
Intake:     ACCOUNT ─► slot/command (advisory + slot + command INSERT/head UPDATE)
Effect:     ACCOUNT ─► slot/command ─► wallet ─► CITY/map ─► MIL/DOM ─► receipt terminal UPDATE
Finalizer:  ACCOUNT ─► slot/command ─► command terminal UPDATE (reject only)
```

No participant may acquire wallet, `map_cell`, or MIL/DOM business locks before completing step 2 for that
transaction. No reverse-order pin acquisition after §4.1 pins are taken.

## 6. Conflict re-read before terminal transitions

**Do not infer city ownership, wallet eligibility, or command outcome from conflict codes alone.**
Immediately before `UPDATE world_first_city_command` to `durable_state IN (2, 3)`:

### 6.1 Common (all terminal writes)

| Evidence | Re-read | Abort if |
|----------|---------|----------|
| Slot head | `world_first_city_actor_slot.head_command_id` | ≠ this `command_id` |
| Command state | `world_first_city_command.durable_state` | ≠ 1 |
| Command body | `canonical_c1`, intake template columns | any drift vs admission generation |
| Account binding | `player.account_id`, `account.status` | drift or not normal |

### 6.2 Effect success (`durable_state=2`) — additional

| Evidence | Re-read | Abort if |
|----------|---------|----------|
| Wallet | locked `player_wallet` row | values out of bounds or unexpected mutation mid-txn |
| Map cell | locked `map_cell` | terrain no longer buildable |
| Coordinate | no `player_city` at `(server_id, x, y)` | occupied by another committed city |
| Allocated ID | sequence/allocator observation + INSERT readback | mismatch or collision |
| `player_city` readback | owner, coordinates, capital flags | ≠ sealed FreshCity identity |
| MIL marker | `mil_city_origin` for `city_id` | unexpected prior row |
| DOM init | `city_production_checkpoint`, `city_building` | unexpected prior rows |
| Receipt columns | wire constants (`is_capital=true`, `wall_level=1`, `morale=100`) | cannot match readback |

On abort: roll back **all** business effects and leave command PENDING unless a separate finalizer path applies.

### 6.3 Rejection finalizer (`durable_state=3`) — additional

| Evidence | Re-read | Whitelist |
|----------|---------|-----------|
| Terrain | `map_cell` **`FOR SHARE`** per [companion §5.1](FIRST_CITY_LEDGER_PG_COMPANION.md#51-finalizer-lock-modes-companion-resolves-global_pins-63) | reason `1` only if still non-buildable |
| Coordinate | `player_city` at requested cell **`FOR SHARE`** per companion §5.1 | reason `2` only if committed occupier exists |
| Business surface | wallet, MIL, DOM tables | **no** new rows for this command |

Finalizer must not commit rejection while any concurrent effect transaction could still succeed on the same command PK.

## 7. Wire, DDL and inventory alignment

- Slot key, `durable_state` values, rejection reasons, and receipt shape match `m4_010_first_city_ledger.sql` and
  [FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md); this file adds **no** wire fields.
- Enrollment inventory in [FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md) lists the same
  shared relations pinned in §4; OID profile does not re-freeze this order.
- Legacy `CreateCityInTx` and lawful **multi-city** actors outside the first-city slot remain governed by existing
  rules; first-city slot constraints apply only to the `(realm_id, server_id, player_id)` ledger namespace.

## 8. Follow-on cards explicitly not frozen here

| Card | Status |
|------|--------|
| SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001 | Frozen in [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md). |
| SPEC-FIRST-CITY-LEDGER-LOADER-001 | Frozen in [FIRST_CITY_LEDGER_LOADER.md](FIRST_CITY_LEDGER_LOADER.md). |
| SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001 | Frozen in [FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md). |
| Reviewed `player_city_id_seq` activation | WORLD_CITY_IDENTITY gate — **not done**. |
| Target realm enrollment execution | Drain/fence/deploy — **not authorized** by #2556. |

## 9. Validation

```bash
./spec/db/validate.sh
```

This card adds documentation only; validation confirms existing `m4_010_first_city_ledger.sql` still composes
with base DDL in disposable `spec_db_validate`. ApplySpecs loader:
[FIRST_CITY_LEDGER_LOADER.md](FIRST_CITY_LEDGER_LOADER.md). Core effect/finalizer terminal races:
[FIRST_CITY_LEDGER_RACE.md](FIRST_CITY_LEDGER_RACE.md). Full effect-path business races:
[FIRST_CITY_LEDGER_EFFECT_PATH.md](FIRST_CITY_LEDGER_EFFECT_PATH.md).

