# WORLD first-city ledger cross-actor slot isolation (SPEC-FIRST-CITY-LEDGER-SLOT-ISOLATION-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. [#2569](https://github.com/anitaguptaoffice/sanguo-slg/issues/2569); stacks [#2568](https://github.com/anitaguptaoffice/sanguo-slg/pull/2568).

Depends on [FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §4, [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §3 intake,
[FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §3–§4.3, [FIRST_CITY_LEDGER_SLOT_CAS.md](FIRST_CITY_LEDGER_SLOT_CAS.md) (same-actor CAS).
**Intake only** (PENDING + head); no wallet/CITY/MIL/DOM; `player_city_id_seq` not activated.
## Isolation key and locks

- **Actor namespace** = full tuple `(realm_id, server_id, player_id)` on both `world_first_city_command` and `world_first_city_actor_slot`.
- Each actor uses its own `world_first_city_slot_advisory_lock(realm_id, server_id, player_id)` (GLOBAL_PINS §3); that lock is **not** a cross-actor mutex.
- Companion §3 / LEDGER §4 intake in one transaction per actor: advisory → slot create-if-absent → `FOR UPDATE` → INSERT PENDING → CAS head.

## Cross-actor invariants (row evidence, not SQL error text)

1. **Concurrent INITIAL, distinct actors, shared realm+server:** Two different `player_id` values on the same `(realm_id, server_id)` may each commit their own PENDING command and head advance. After both commit, each actor’s slot/head/command rows reference only that actor’s `command_id`; neither actor’s rows are UPDATE/DELETE’d by the peer.
2. **Distinct isolation keys:** Same `player_id` on different `server_id` and/or `realm_id` behaves like (1); isolation is the full triple, not player-only or server-only.
3. **Mid-intake holder vs peer INITIAL:** While actor A holds its own advisory + slot `FOR UPDATE` and has not committed, actor B (different triple) must still commit its own INITIAL within bounded lock timeouts; B must not be indefinitely blocked or aborted solely because A is mid-intake. After A and B resolve, each actor’s committed rows remain scoped to that actor only.
4. **Same `command_id` string, different namespaces:** The same UUID text may exist once per actor namespace. A subsequent HEAD_CONFLICT / stale-predecessor intake failure on one actor must leave no INSERT/UPDATE residue on another actor’s slot/command/head rows.

`hashtextextended` collision breaking (1)–(4) is harness **failure evidence**; do not change GLOBAL_PINS §3.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable'
export ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_slot_isolation
```

## Follow-on (separate SPEC cards)

**SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001** frozen in [FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md) (`first_city_ledger_id_content_conflict`). Optional one-PENDING-per-slot partial unique index, ACL, crash barriers, `validate_only` GUC, `player_city_id_seq` activation, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence.
