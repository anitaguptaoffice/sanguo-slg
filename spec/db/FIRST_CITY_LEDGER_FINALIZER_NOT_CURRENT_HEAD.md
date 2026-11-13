# Finalizer must match current head and not advance successor (SPEC-FIRST-CITY-LEDGER-FINALIZER-NOT-CURRENT-HEAD-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2722](https://github.com/anitaguptaoffice/sanguo-slg/issues/2722). Stacks Draft
[#2719](https://github.com/anitaguptaoffice/sanguo-slg/pull/2719) /
[#2718](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6 (finalizer may
atomically terminate only when binding, canonical content, and **head** match; **must not advance
successor**); §11 **finalizer** row;
[FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5.2 slot head `FOR UPDATE` re-read.

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2697](FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md) ACCOUNT/binding drift | Slot **head_command_id** mismatch vs retained PENDING row |
| [#2571](FIRST_CITY_LEDGER_ID_CONTENT_CONFLICT.md) intake ID/content paths | Finalizer SQL on non-head **PENDING** |
| [#2563](FIRST_CITY_LEDGER_RACE.md) effect/finalizer PK terminal race | Head/successor discipline; not concurrent winner grid |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist / exact-attempt | Assumes current head; no successor advance proof |

**`player_city_id_seq` not activated.**

## Invariants (row evidence)

1. **Not current head:** Stale command stays `PENDING` while `head_command_id` points at another (terminal)
   command id → finalizer on stale id must `ROLLBACK`; stale row keeps `durable_state=1`; head unchanged.
2. **No successor advance:** Successful reject on **current** head → sole `durable_state=3`; `head_command_id`
   still references that same command id (not `NULL`, not a successor).
3. **Control:** Current head + non-buildable terrain → `COMMIT` `rejection_reason=1`, zero business rows.

## Scenarios (harness minimum)

1. Head references terminal successor while stale command still `PENDING` → finalizer on stale id blocked.
2. Valid reject on current head → terminal reject; head still same command id.
3. Control reject on current head (terrain reason `1`).

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_not_current_head
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_not_current_head:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-PRESERVE-TERMINAL-001** —
[FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md](FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md)
(`first_city_ledger_finalizer_preserve_terminal`). CITY_CREATION_RECOVERY §10 item 3 **remaining** after
that slice (if any), §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 —
separate SPEC cards.
