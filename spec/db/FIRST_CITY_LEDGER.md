# WORLD first-city ledger (SPEC-FIRST-CITY-LEDGER-DDL-001)

Registered contract; **not** adopted, wired, realm-enrolled or production-enabled.
Task: [#2552](https://github.com/anitaguptaoffice/sanguo-slg/issues/2552).
Baseline at registration: main `80f147b6c1be4e1c47fc4c1e9ab2d23379ac4e7e`.
Depends on [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §2–5 and §9–10,
[FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md), [first_city.proto](../proto/sanguo/world/v2/first_city.proto),
[FRESH_CITY_TEMPLATE_CODEC.md](../rules/FRESH_CITY_TEMPLATE_CODEC.md), and frozen `002_world.sql`.

## 1. Purpose and explicit non-goals

Freeze the minimum durable SQL surface for WORLD-owned first-city intake, lineage, head,
immutable canonical C1, intake-time FCT1 template, and terminal receipts matching wire
`FirstCityRecord` / `FirstCityHead`. UNKNOWN and NOT_OBSERVED are **not** stored.

This card does **not**:
- certify a target realm, cutover, fencing, deployment, or live routes;
- modify `002_world.sql`, `player_city`, or legacy CreateCity / lawful multi-city semantics;
- prove physical realm isolation (`002_world.sql` has **no** `realm` column; a `realm_id`
  UUID namespace here is logical enrollment, not database/schema fencing);
- implement runtime writers, finalizer, DOM/APP coordination, or receipt+business atomic commits
  (those remain separate §10 items).

## 2. Relations (core inventory)

| Object | Role |
|--------|------|
| `world_first_city_command` | One retained row per `(realm_id, server_id, player_id, command_id)`; stores immutable C1, template ref fields, FCT1 bytes, `durable_state` 1/2/3, and receipt columns. |
| `world_first_city_actor_slot` | One row per stable actor slot `(realm_id, server_id, player_id)`; `head_command_id NULL` = wire EMPTY head; non-NULL references the current head command in the same actor namespace. |

**Wire mapping:** `durable_state` 1 → `pending {}`; 2 → `succeeded` with frozen `is_capital=true`, `wall_level=1`, `morale=100`; 3 → `rejected_no_effect` with `rejection_reason` 1 (`TERRAIN`) or 2 (`COORDINATE_OCCUPIED`). Same `command_id` with different `canonical_c1` must be rejected by the writer without UPDATE; the trigger forbids changing intake bytes and forbids DELETE.

**ID retention:** primary key uniqueness only; no reuse, rotation, or DELETE. Terminal rows stay terminal.

## 3. Intake, head, and same-transaction receipt shape

**PENDING intake** (single transaction, after slot serialization):
1. INSERT `world_first_city_command` with `durable_state=1`, full C1+template, `received_at`.
2. UPDATE `world_first_city_actor_slot` set `head_command_id` to the new command when predecessor/CAS rules pass.

**Success receipt** (`durable_state=2`): same **effect** transaction that commits WORLD city INSERT,
wallet/MIL/DOM effects (per CITY_CREATION_RECOVERY §6) must also set success receipt columns and
`terminal_at` on this command row and must not commit business effects without the matching receipt
update on the same command PK. This DDL states the column contract only; cross-relation atomicity is
implemented on a follow-on card. `world_first_city_command_success_receipt_check` physically requires
`success_server_id = server_id` and `success_player_id = player_id` so the stored success receipt
matches the command row's canonical scope (FIRST-CITY-WIRE.md §3).

**Rejection receipt** (`durable_state=3`): narrow finalizer (§7) may transition only a matching
PENDING row to `durable_state=3` with whitelisted `rejection_reason`; no city row, no wallet grant.

**Head EMPTY:** absence of slot row or slot with `head_command_id IS NULL` after certified history checks
maps to wire `FirstCityEmpty` for discovery; creating the slot row is part of intake, not a separate
mutable flag.

## 4. Missing-row slot CAS (required writer sequence)

`SELECT FOR UPDATE` on a **missing** slot row does not lock any tuple and is **not** a serialization
proof under READ COMMITTED. Writers must use **all** of the following in one database transaction:

1. **Advisory transaction lock** on a stable 64-bit key derived from `(realm_id, server_id, player_id)`
   using `pg_advisory_xact_lock(hashtextextended(slot_key, 0))` (or an equivalent reviewed single-slot
   lock ordering documented on a follow-on global-pins card). Hold this lock for the entire intake or
   head transition.
2. **`INSERT INTO world_first_city_actor_slot ... ON CONFLICT DO NOTHING`**: create-if-absent for the
   actor slot; on unique violation, proceed to step 3 without assuming EMPTY.
3. **`SELECT ... FROM world_first_city_actor_slot WHERE ... FOR UPDATE`**: lock the existing slot row.
4. Re-read `head_command_id`, compare predecessor against wire/C1 rules, then INSERT command and
   UPDATE head in the **same** transaction.

Competing INITIAL proposals: at most one succeeds; losers must not write business effects. A peer
transaction with an open PENDING intake on the same slot must block at step 3 until the prior
transaction commits or rolls back—never infer EMPTY from a transient absence under READ COMMITTED.

Optional hardening (follow-on card): partial unique indexes for “at most one PENDING per slot” if
reviewed; not required for this core schema.

## 5. Transaction isolation and lock strength

| Phase | Minimum isolation | Row/table locks |
|-------|-------------------|-----------------|
| Provisioning (`m4_010_first_city_ledger.sql`) | READ COMMITTED | DO block only; no production intake. |
| Durable intake / head move | READ COMMITTED **plus** per-slot advisory xact lock (§4) | `FOR UPDATE` on slot row after create-if-absent; INSERT command. |
| Continue / effect / finalizer | READ COMMITTED unless a later card proves SERIALIZABLE for a whole effect txn | Re-lock slot row `FOR UPDATE`; re-read `durable_state` before terminal transition. |

`SELECT FOR UPDATE` alone on an existing slot is necessary but **insufficient** without §4 steps 1–2.
Effect transactions must pin reviewed WORLD/ACCOUNT/MIL/DOM relations under separately frozen global
lock order (§10.2 follow-on); this file does not freeze that order.

## 6. Constraint and conflict semantics (wire-aligned)

- **ID_CONTENT_CONFLICT:** existing PK row with different `canonical_c1` → writer returns conflict;
  trigger blocks overwrite.
- **HEAD_CONFLICT:** head/predecessor mismatch → no INSERT/UPDATE; no mutation.
- **COMMAND:** same ID and same C1 → read-only return; no template refresh.
- **NOT_OBSERVED / EMPTY:** read paths only; no rows for those labels.

## 7. Validation

```bash
./spec/db/validate.sh
```

Runs `m4_010_first_city_ledger.sql` in the disposable `spec_db_validate` schema with other `00*.sql`
and `m3_*.sql` / `m4_*.sql` files. No runtime loader in this card.

## 8. Follow-on SPEC cards (not frozen here)

Per CITY_CREATION_RECOVERY §10.2, still required before activation:

1. **SPEC-FIRST-CITY-LEDGER-OID-PROFILE-001** — target cluster/database/schema OID/profile/writer
   inventory and ACL proofs at activation.
2. **SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001** — ACCOUNT → slot/command → wallet → CITY/map → MIL/DOM
   pin order, row locks, and conflict re-read proofs.
3. **SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001** — participant SQL companions and effect/finalizer
   transitions bound to this schema.
4. **SPEC-FIRST-CITY-LEDGER-LOADER-001** — ApplySpecs replay, missing-ledger idempotency, and
   isolated PG17 acceptance tests (pattern: `hero_metadata_loader`, `recruit_storage_entry`).

Do not merge runtime until those cards and wire/template artifacts are independently reviewed.
