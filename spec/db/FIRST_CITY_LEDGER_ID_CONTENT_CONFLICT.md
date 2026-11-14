# WORLD first-city ledger ID_CONTENT_CONFLICT path (SPEC-FIRST-CITY-LEDGER-ID-CONTENT-CONFLICT-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. [#2571](https://github.com/anitaguptaoffice/sanguo-slg/issues/2571);
stacks [#2570](https://github.com/anitaguptaoffice/sanguo-slg/pull/2570). Depends on
[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2/§6, [FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §3,
[FIRST_CITY_LEDGER_SLOT_ISOLATION.md](FIRST_CITY_LEDGER_SLOT_ISOLATION.md), [FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md).
Intake + ledger reads only; no effect rows; `player_city_id_seq` not activated.

## Boundaries

| Label | Condition | Mutation | Response |
|-------|-----------|----------|----------|
| **ID_CONTENT_CONFLICT** | PK exists, `canonical_c1` differs | None | Existing record (not proposal) |
| **COMMAND** | PK exists, same `canonical_c1` | None; no re-intake / template refresh | Existing record |
| **HEAD_CONFLICT** | New `command_id`, bad predecessor | None | Writer rollback |
| Cross-actor same UUID | Different `(realm_id, server_id, player_id)` | Per actor | Not content conflict (#2570) |

Submit compares **existing ID first**. Continue: unknown ID **no INSERT**; terminal + different C1 → **ID_CONTENT_CONFLICT** without receipt/state change.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_id_content_conflict
```

## Follow-on

**SPEC-FIRST-CITY-LEDGER-PENDING-UNIQUE-INDEX-001** frozen in [FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md](FIRST_CITY_LEDGER_PENDING_UNIQUE_INDEX.md) (`first_city_ledger_pending_unique_index`). ACL, crash barriers, `validate_only` GUC, `player_city_id_seq`, CITY_CREATION_RECOVERY §10 items 3/5–7, realm drain/fence.
