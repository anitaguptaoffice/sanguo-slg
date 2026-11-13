# Finalizer must not overwrite committed terminals (SPEC-FIRST-CITY-LEDGER-FINALIZER-PRESERVE-TERMINAL-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2726](https://github.com/anitaguptaoffice/sanguo-slg/issues/2726). Stacks Draft
[#2723](https://github.com/anitaguptaoffice/sanguo-slg/pull/2723) /
[#2722](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6 (competitor success must
remain; committed rejections must not be overwritten); §11 **finalizer** row;
[FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5.2–5.3 (`durable_state=1` gate).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2563](FIRST_CITY_LEDGER_RACE.md) concurrent effect/finalizer PK race | **Post-commit** narrow finalizer retry; no concurrent grid |
| [#2722](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md) head / successor discipline | Terminal row already committed (`2` or `3`) |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist from `PENDING` | Assumes `durable_state=1` at terminal `UPDATE` |

**`player_city_id_seq` not activated.** Fixture `success_city_id=88001` only.

## Invariants (row evidence)

1. **Success preserved:** After committed `durable_state=2` with success receipt columns, a later
   companion-style finalizer attempt must `ROLLBACK`; row stays `2` with the same `success_city_id`.
2. **Rejection preserved:** After committed `durable_state=3` with `rejection_reason=1`, a retry
   finalizer must `ROLLBACK`; `rejection_reason` and `terminal_at` unchanged.
3. **Control:** Fresh `PENDING` on current head may still `COMMIT` lawful reject (`durable_state=3`).

## Scenarios (harness minimum)

1. Seed terminal success → finalizer blocked → still `2` / same success receipt.
2. Seed terminal reject → finalizer blocked → still `3` / same `rejection_reason`.
3. Control `PENDING` → lawful reject `COMMIT`.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_preserve_terminal
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_preserve_terminal:` line.

## Follow-on

CITY_CREATION_RECOVERY §10 item 3 **remaining** after this slice (if any), §10 items **5–7**,
target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
