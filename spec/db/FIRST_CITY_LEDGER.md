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
   using `pg_advisory_xact_lock(hashtextextended(slot_key_text, 0))` with `slot_key_text` per
   [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §3. Hold this lock for the entire intake or
   head transition.
2. **`INSERT INTO world_first_city_actor_slot ... ON CONFLICT DO NOTHING`**: create-if-absent for the
   actor slot; on unique violation, proceed to step 3 without assuming EMPTY.
3. **`SELECT ... FROM world_first_city_actor_slot WHERE ... FOR UPDATE`**: lock the existing slot row.
4. Re-read `head_command_id`, compare predecessor against wire/C1 rules, then INSERT command and
   UPDATE head in the **same** transaction.

Competing INITIAL proposals: at most one succeeds; losers must not write business effects. A peer
transaction with an open PENDING intake on the same slot must block at step 3 until the prior
transaction commits or rolls back—never infer EMPTY from a transient absence under READ COMMITTED.

Partial unique “at most one PENDING per slot” is frozen in
[FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md) (`m4_012`); it is a catalog backstop, not a substitute for §4 CAS.

## 5. Transaction isolation and lock strength

| Phase | Minimum isolation | Row/table locks |
|-------|-------------------|-----------------|
| Provisioning (`m4_010_first_city_ledger.sql`) | READ COMMITTED | DO block only; no production intake. |
| Durable intake / head move | READ COMMITTED **plus** per-slot advisory xact lock (§4) | `FOR UPDATE` on slot row after create-if-absent; INSERT command. |
| Continue / effect / finalizer | READ COMMITTED unless a later card proves SERIALIZABLE for a whole effect txn | Re-lock slot row `FOR UPDATE`; re-read `durable_state` before terminal transition. |

`SELECT FOR UPDATE` alone on an existing slot is necessary but **insufficient** without §4 steps 1–2.
Effect transactions must obey [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md); this
file references intake slot steps only.

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

1. **SPEC-FIRST-CITY-LEDGER-OID-PROFILE-001** — frozen in
   [FIRST_CITY_LEDGER_OID_PROFILE.md](FIRST_CITY_LEDGER_OID_PROFILE.md); enrollment profile,
   writer inventory and pre-activation ACL/drain obligations (does not certify any realm).
2. **SPEC-FIRST-CITY-LEDGER-GLOBAL-PINS-001** — frozen in
   [FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md); ACCOUNT → slot/command → wallet →
   CITY/map → MIL/DOM pin order, row locks, and conflict re-read proofs (does not certify any realm).
3. **SPEC-FIRST-CITY-LEDGER-PG-COMPANION-001** — frozen in
   [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md); participant SQL companions
   and effect/finalizer transitions bound to this schema.
4. **SPEC-FIRST-CITY-LEDGER-LOADER-001** — frozen in
   [FIRST_CITY_LEDGER_LOADER.md](FIRST_CITY_LEDGER_LOADER.md); ApplySpecs replay, missing-ledger
   idempotency, disposable PG17 acceptance (`spec/db/tests/first_city_ledger_loader`).
5. **SPEC-FIRST-CITY-LEDGER-RACE-001** — frozen in
   [FIRST_CITY_LEDGER_RACE.md](FIRST_CITY_LEDGER_RACE.md); companion §5.3 core effect/finalizer races
   (`spec/db/tests/first_city_ledger_race`); does not certify any realm.
6. **SPEC-FIRST-CITY-LEDGER-EFFECT-PATH-001** — frozen in
   [FIRST_CITY_LEDGER_EFFECT_PATH.md](FIRST_CITY_LEDGER_EFFECT_PATH.md); §4.2 business + terminal effect-path races
   (`spec/db/tests/first_city_ledger_effect_path`); does not certify any realm.
7. **SPEC-FIRST-CITY-LEDGER-SLOT-CAS-001** — frozen in
   [FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md); §4 slot/head intake CAS matrix
   (`spec/db/tests/first_city_ledger_slot_cas`); does not certify any realm.
8. **SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001** — frozen in
   [FIRST_CITY_LEDGER_SLOT_ISOLATION.md](FIRST_CITY_LEDGER_SLOT_ISOLATION.md); cross-actor slot isolation (`spec/db/tests/first_city_ledger_slot_isolation`); does not certify any realm.
9. **SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001** — frozen in
   [FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md); same-PK `ID_CONTENT_CONFLICT` / same-C1 COMMAND (`spec/db/tests/first_city_ledger_id_content_conflict`); does not certify any realm.
9b. **SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001** — frozen in
   [FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md); one-PENDING partial unique index (`spec/db/tests/first_city_ledger_pending_unique_index`); does not certify any realm.
9c. **SPEC-FIRST-CITY-LEDGER-ACL-001** — frozen in
   [FIRST_CITY_LEDGER_ACL.md](FIRST_CITY_LEDGER_ACL.md); restricted-role ACL / privilege separation (`spec/db/tests/first_city_ledger_acl`); does not certify any realm.
9d. **SPEC-FIRST-CITY-LEDGER-VALIDATE-ONLY-001** — [FIRST_CITY_LEDGER_VALIDATE_ONLY.md](FIRST_CITY_LEDGER_VALIDATE_ONLY.md); `sanguo.first_city_ledger_validate_only` harness; no realm / no `player_city_id_seq`.
9e. **SPEC-FIRST-CITY-LEDGER-PLAYER-CITY-ID-SEQ-001** — [FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md](FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md); reviewed `player_city_id_seq` shape + disposable PG17 next-value/fail-closed harness (`spec/db/tests/first_city_ledger_player_city_id_seq`); not production activation / not runtime allocator.
9f. **SPEC-FIRST-CITY-LEDGER-CRASH-GAP-001** — [FIRST_CITY_LEDGER_CRASH_GAP.md](FIRST_CITY_LEDGER_CRASH_GAP.md); §7.9/§11 finalizer effect-rollback crash gap (`spec/db/tests/first_city_ledger_crash_gap`); not ATOMICITY re-run / not realm certification.
9g. **SPEC-FIRST-CITY-LEDGER-FINALIZER-ACCOUNT-BLOCK-001** — [FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md](FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md); §7.6/§11 finalizer ACCOUNT fail-closed (`spec/db/tests/first_city_ledger_finalizer_account_block`); not FINALIZER-ROLLBACK re-run / not realm certification.
9h. **SPEC-FIRST-CITY-LEDGER-FINALIZER-TERRAIN-GAP-001** — [FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md](FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md); §7.8/§11 finalizer inter-gap terrain flip (`spec/db/tests/first_city_ledger_finalizer_terrain_gap`); not FINALIZER-ROLLBACK re-run / not realm certification.
9i. **SPEC-FIRST-CITY-LEDGER-FINALIZER-COMMIT-UNCERTAIN-POISON-001** — [FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md); §7.10/§11 finalizer commit-uncertain poison (`spec/db/tests/first_city_ledger_finalizer_commit_uncertain_poison`); not phase-admission re-run / not realm certification.
9j. **SPEC-FIRST-CITY-LEDGER-FINALIZER-RECEIPT-NO-SOURCE-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md); §7.7/§11 finalizer receipt≠source drain (`spec/db/tests/first_city_ledger_finalizer_receipt_no_source_drain`); not unknown-drain five-scenario re-run / not realm certification.
9k. **SPEC-FIRST-CITY-LEDGER-FINALIZER-STALE-EVIDENCE-001** — [FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md); §7.5/§11 stale rollback evidence blocked under poison/drift (`spec/db/tests/first_city_ledger_finalizer_stale_evidence`); not receipt-no-source-drain re-run / not realm certification.
9l. **SPEC-FIRST-CITY-LEDGER-FINALIZER-EFFECT-UNCERTAIN-NO-PROOF-001** — [FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md); §7.1/§7.10 effect or intake commit-uncertain cannot authorize narrow finalizer rollback proof (`spec/db/tests/first_city_ledger_finalizer_effect_uncertain_no_proof`); not stale-evidence / finalizer-commit-uncertain re-run / not realm certification.
9m. **SPEC-FIRST-CITY-LEDGER-FINALIZER-NOT-CURRENT-HEAD-001** — [FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md); §7.6 finalizer head match / no successor advance (`spec/db/tests/first_city_ledger_finalizer_not_current_head`); not account-block / race re-run / not realm certification.
9n. **SPEC-FIRST-CITY-LEDGER-FINALIZER-PRESERVE-TERMINAL-001** — [FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md](FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md); §7.6 committed terminal immutability on narrow finalizer retry (`spec/db/tests/first_city_ledger_finalizer_preserve_terminal`); not race concurrent grid re-run / not realm certification.
9o. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-CONTINUITY-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md); §7.4 generation-bound lease across effect rollback→finalizer Begin (`spec/db/tests/first_city_ledger_finalizer_lease_continuity`); not phase-admission close/poison re-run / not realm certification.
9p. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md); §7.4 lease classify after effect txn boundary (`spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary`); not lease-continuity re-run / not realm certification.
9q. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-UNKNOWN-ENDING-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md); §7.4 `effect_ending=unknown` lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary_unknown_ending`); not #2738 open/known_rollback re-run / does not close #2737 Acceptance / not realm certification.
9r. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-PHASE-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_PHASE.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_PHASE.md); §7.4 finalizer phase before lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_finalizer_phase`); not #2738/#2742 txn-boundary re-run / does not close #2737/#2739 Acceptance / not realm certification.
9s. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-ENDING-UNKNOWN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md); §7.4 `finalizer_ending=unknown` lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_finalizer_ending_unknown`); not #2746 phase re-run / does not close #2737/#2739/#2744 Acceptance / not realm certification.
9t. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SIBLING-UNKNOWN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md); §7.4/§8 sibling command `ending=unknown` lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_sibling_unknown`); not #2577 drain / #2710 receipt re-run / does not close #2737/#2739/#2744/#2747 Acceptance / not realm certification.
9u. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SOURCE-POISONED-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_SOURCE_POISONED.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_SOURCE_POISONED.md); §7.4/§8 `admission=poisoned` lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_source_poisoned`); not #2577 drain / #2575 phase-admission / #2713 stale-evidence re-run / does not close #2737/#2739/#2744/#2747/#2753 Acceptance / not realm certification.
9v. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md); §7.4/§8 `admission=closed` held-lease classify (`spec/db/tests/first_city_ledger_finalizer_lease_normal_close`); not #2757 poisoned re-run / #2575 phase-admission re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757 Acceptance / not realm certification.
9w. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md); normal close strict classify before `declare_drained` (`first_city_ledger_finalizer_lease_normal_close_drain`); not #2762/#2577 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761 Acceptance.
9x. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-MULTI-COMMAND-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_MULTI_COMMAND_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_MULTI_COMMAND_DRAIN.md); multi-command known endings gate `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_multi_command_drain`); not #2769/#2577/#2753 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767 Acceptance.
9y. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-UNKNOWN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_UNKNOWN_DRAIN.md); sibling `unknown` gates `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_sibling_unknown_drain`); not #2774/#2753/#2577 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773 Acceptance.
9z. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SOURCE-POISONED-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SOURCE_POISONED_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SOURCE_POISONED_DRAIN.md); `admission=poisoned` blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_source_poisoned_drain`); not #2778/#2757/#2577 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775 Acceptance.
9za. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-UNKNOWN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md); head `effect_ending=unknown` blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_effect_unknown_drain`); not #2782/#2739/#2577 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780 Acceptance.
9zb. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-UNKNOWN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_UNKNOWN_DRAIN.md); head `finalizer_ending=unknown` blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_finalizer_ending_unknown_drain`); not #2789/#2747 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788 Acceptance.
9zc. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-TXN-OPEN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_TXN_OPEN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_TXN_OPEN_DRAIN.md); open effect txn blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_effect_txn_open_drain`); not #2794/#2738 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792 Acceptance.
9zd. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-PHASE-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_PHASE_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_PHASE_DRAIN.md); finalizer phase gap/in-flight blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_finalizer_phase_drain`); not #2744/#2798 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797 Acceptance.
9ze. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-BEGIN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_BEGIN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_BEGIN_DRAIN.md); in-flight `effect_begin` with closed known_rollback blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_effect_begin_drain`); not #2797/#2805 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797/#2805 Acceptance.
9zf. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-PENDING-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_PENDING_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_PENDING_DRAIN.md); closed txn with head `effect_ending=pending` blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_effect_pending_drain`); not #2797/#2788/#2808 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797/#2805/#2808 Acceptance.
9zg. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-ENDING-PENDING-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_PENDING_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_PENDING_DRAIN.md); effect `known_rollback` with head `finalizer_ending=pending` blocks `declare_drained` under normal close strict classify (`first_city_ledger_finalizer_lease_normal_close_finalizer_ending_pending_drain`); not #2792/#2817 re-run / does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761/#2767/#2773/#2775/#2780/#2788/#2792/#2797/#2805/#2808/#2817 Acceptance.
9zh. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-ENDING-PENDING-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_PENDING_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_PENDING_DRAIN.md); sibling `finalizer_ending=pending` gates `declare_drained` under normal close (`first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_pending_drain`); not #2823/#2774/#2775 re-run / does not close #2737–#2823 Acceptance.
9zi. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-PENDING-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_PENDING_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_PENDING_DRAIN.md); sibling closed-txn `effect_ending=pending` gates `declare_drained` under normal close (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_pending_drain`); not #2817/#2830/#2774 re-run / does not close #2737–#2830 Acceptance.
9zj. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-TXN-OPEN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md); sibling `txn_open=true` gates `declare_drained` under normal close (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_txn_open_drain`); not #2797/#2834 re-run / does not close #2737–#2834 Acceptance.
9zk. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-UNKNOWN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md); sibling closed-txn `effect_ending=unknown` gates `declare_drained` under normal close (`first_city_ledger_finalizer_lease_normal_close_sibling_effect_unknown_drain`); not #2788/#2834/#2841 re-run / does not close #2737–#2841 Acceptance.
9zl. **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-ENDING-UNKNOWN-DRAIN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_UNKNOWN_DRAIN.md); sibling `finalizer_ending=unknown` gates `declare_drained` under normal close (`first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_unknown_drain`); not #2792/#2830/#2848 re-run / does not close #2737–#2848 Acceptance.
10. **SPEC-FIRST-CITY-LEDGER-FINALIZER-ROLLBACK-001** — frozen in
   [FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md); companion §5 narrow finalizer full rollback / whitelist / exact-attempt (`spec/db/tests/first_city_ledger_finalizer_rollback`); does not certify any realm.
11. **SPEC-FIRST-CITY-LEDGER-PHASE-ADMISSION-001** — frozen in
   [FIRST_CITY_LEDGER_PHASE_ADMISSION.md](FIRST_CITY_LEDGER_PHASE_ADMISSION.md); phase admission / generation-bound lease / close-vs-poison linearization (`spec/db/tests/first_city_ledger_phase_admission`); does not certify any realm or deploy admission controller.
12. **SPEC-FIRST-CITY-LEDGER-UNKNOWN-DRAIN-001** — frozen in
   [FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md); unknown drain / receipt≠source-drain / post-drain generation continue (`spec/db/tests/first_city_ledger_unknown_drain`); does not certify any realm.
13. **SPEC-FIRST-CITY-LEDGER-ACK-LOSS-001** — [FIRST_CITY_LEDGER_ACK_LOSS.md](FIRST_CITY_LEDGER_ACK_LOSS.md) (`first_city_ledger_ack_loss`); does not certify any realm.
14. **SPEC-FIRST-CITY-LEDGER-ATOMICITY-001** — [FIRST_CITY_LEDGER_ATOMICITY.md](FIRST_CITY_LEDGER_ATOMICITY.md) (`first_city_ledger_atomicity`); per-barrier effect txn §6/§11 atomicity only; does not certify any realm.
15. **SPEC-FIRST-CITY-LEDGER-INITIAL-001** — [FIRST_CITY_LEDGER_INITIAL.md](FIRST_CITY_LEDGER_INITIAL.md) (`first_city_ledger_initial`); §5 / §11 INITIAL intake arbitration only; does not certify any realm.
16. **SPEC-FIRST-CITY-LEDGER-ABSENCE-001** — [FIRST_CITY_LEDGER_ABSENCE.md](FIRST_CITY_LEDGER_ABSENCE.md) (`first_city_ledger_absence`); §11 absence / in-flight lookup only; does not certify any realm.
17. **SPEC-FIRST-CITY-LEDGER-RETENTION-CUTOVER-001** — [FIRST_CITY_LEDGER_RETENTION_CUTOVER.md](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md) (`first_city_ledger_retention_cutover`); §9/§11 retention fail-closed only; does not certify any realm or production cutover.
18. **SPEC-FIRST-CITY-LEDGER-MAPPING-FENCE-001** — [FIRST_CITY_LEDGER_MAPPING_FENCE.md](FIRST_CITY_LEDGER_MAPPING_FENCE.md) (`first_city_ledger_mapping_fence`); §9/§11 physical mapping + continuous fence fail-closed only; does not certify any realm, production online fence, or cutover.
19. **SPEC-FIRST-CITY-LEDGER-ONLINE-EXCLUSION-001** — [FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md](FIRST_CITY_LEDGER_ONLINE_EXCLUSION.md) (`first_city_ledger_online_exclusion`); §9/§11 leftover connection / direct SQL / allocator progress + last-txn drain fail-closed only; does not certify production old-writer binary exclusion, realm, or cutover.
20. **SPEC-FIRST-CITY-LEDGER-OLD-BINARY-EXCLUSION-001** — [FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md) (`first_city_ledger_old_binary_exclusion`); OID §6.1/11 legacy subprocess only; not signed rollback/realm/controller.
21. **SPEC-FIRST-CITY-LEDGER-DOM-API-CHAIN-EXCLUSION-001** — [FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md](FIRST_CITY_LEDGER_DOM_API_CHAIN_EXCLUSION.md) (`first_city_ledger_dom_api_chain_exclusion`); OID §6.2 DOM `saveCityWithWorld` / API `CreateNewCity` subprocess chain only; not realm/controller/browser/signed rollback.
22. **SPEC-FIRST-CITY-LEDGER-GM-IMPORT-EXCLUSION-001** — [FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md](FIRST_CITY_LEDGER_GM_IMPORT_EXCLUSION.md) (`first_city_ledger_gm_import_exclusion`); OID §6.3 GM/import batch-SQL maintenance subprocess only; not realm/controller/browser/signed rollback.
23. **SPEC-FIRST-CITY-LEDGER-SNAPSHOT-FLUSH-EXCLUSION-001** — [FIRST_CITY_LEDGER_SNAPSHOT_FLUSH_EXCLUSION.md](FIRST_CITY_LEDGER_SNAPSHOT_FLUSH_EXCLUSION.md) (`first_city_ledger_snapshot_flush_exclusion`); OID §6.5 snapshot flusher / async persistence subprocess only; not realm/controller/browser/signed rollback.
24. **SPEC-FIRST-CITY-LEDGER-RESTORE-JOB-EXCLUSION-001** — [FIRST_CITY_LEDGER_RESTORE_JOB_EXCLUSION.md](FIRST_CITY_LEDGER_RESTORE_JOB_EXCLUSION.md) (`first_city_ledger_restore_job_exclusion`); OID §6.6 backup restore / retention job subprocess only; not realm/controller/browser/signed rollback; does not re-run #2588 retention/cutover data matrix.
25. **SPEC-FIRST-CITY-LEDGER-DDL-EXCLUSION-001** — [FIRST_CITY_LEDGER_DDL_EXCLUSION.md](FIRST_CITY_LEDGER_DDL_EXCLUSION.md) (`first_city_ledger_ddl_exclusion`); OID §6 row 7 DDL only; not realm/controller/browser/signed rollback.
26. **SPEC-FIRST-CITY-LEDGER-SEQUENCE-REPAIR-EXCLUSION-001** — [FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md](FIRST_CITY_LEDGER_SEQUENCE_REPAIR_EXCLUSION.md) (`first_city_ledger_sequence_repair_exclusion`); OID §6 row 8 standalone nextval/setval/sequence repair only; not `player_city_id_seq`, realm/controller/browser/signed rollback.
27. **SPEC-FIRST-CITY-LEDGER-BACKGROUND-WRITER-EXCLUSION-001** — [FIRST_CITY_LEDGER_BACKGROUND_WRITER_EXCLUSION.md](FIRST_CITY_LEDGER_BACKGROUND_WRITER_EXCLUSION.md) (`first_city_ledger_background_writer_exclusion`); OID §6 row 10 queues/mail/rank/chat co-located background writers only; not `player_city_id_seq`, realm/controller/browser/signed rollback.
28. **SPEC-FIRST-CITY-LEDGER-SIGNED-ROLLBACK-EXCLUSION-001** — [FIRST_CITY_LEDGER_SIGNED_ROLLBACK_EXCLUSION.md](FIRST_CITY_LEDGER_SIGNED_ROLLBACK_EXCLUSION.md) (`first_city_ledger_signed_rollback_exclusion`); OID §6 row 11 signed/prior-release artifact apply subprocess only; not in-process #2594 `legacy_worker`, not `player_city_id_seq`, realm/controller/browser/production artifact deployment.
29. **SPEC-FIRST-CITY-LEDGER-NEW-INTAKE-AUTHORIZATION-001** — [FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md](FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md) (`first_city_ledger_new_intake_authorization`); OID §6 row 12 new ledger intake/effect/finalizer unauthorized-until-§5/inventory only; not production route, not `player_city_id_seq`, realm/controller/browser/signed rollback re-runs.

Do not merge runtime until those cards and wire/template artifacts are independently reviewed.
