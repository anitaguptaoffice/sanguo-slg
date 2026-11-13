# Finalizer account-binding fail-closed (SPEC-FIRST-CITY-LEDGER-FINALIZER-ACCOUNT-BLOCK-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2697](https://github.com/anitaguptaoffice/sanguo-slg/issues/2697). Stacks Draft
[#2690](https://github.com/anitaguptaoffice/sanguo-slg/pull/2690) /
[#2689](FIRST_CITY_LEDGER_CRASH_GAP.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.6 (finalizer
re-validates source/ACCOUNT under slot/command locks), end of §7 (ACCOUNT 失效只阻断资格、不得强改
历史 PENDING), §11 **finalizer** row (ACCOUNT 失效不能终结旧命令);
[FIRST_CITY_LEDGER_GLOBAL_PINS.md](FIRST_CITY_LEDGER_GLOBAL_PINS.md) §6.1 account binding re-read;
[FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5.2 account `FOR SHARE`.

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist / full rollback / exact-attempt | Account `status` / binding drift abort before terminal `UPDATE` |
| [#2689](FIRST_CITY_LEDGER_CRASH_GAP.md) rollback→finalizer session crash gap | Binding checks at finalizer attempt; no cross-session gap matrix |
| [#2563](FIRST_CITY_LEDGER_RACE.md) effect/finalizer PK terminal race | No concurrent terminal race grid |

Fixture non-buildable `terrain`; **`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Banned account:** After intake `PENDING`, `account.status <> 1` → finalizer must `ROLLBACK`;
   row stays `durable_state=1` with no `terminal_at` / `rejection_reason`.
2. **Player binding drift:** `player.account_id` no longer equals `world_first_city_command.account_id`
   → finalizer must `ROLLBACK`; command stays `PENDING`.
3. **Rebind after intake:** New `player.account_id` with command still pointing at old `account_id`
   → `ROLLBACK`, PENDING retained (does not auto-reject history).
4. **Control:** Normal binding + non-buildable terrain + whitelist reason `1` may still `COMMIT`
   `durable_state=3` with zero business rows (proves checks are conditional, not total finalizer lockout).

## Scenarios (harness minimum)

1. `status=2` (banned) before finalizer → `ROLLBACK`, PENDING.
2. `UPDATE player SET account_id=…` drift → `ROLLBACK`, PENDING.
3. Normal account + terrain non-buildable → `COMMIT` reason `1`, no business rows.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_account_block
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_account_block:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-TERRAIN-GAP-001** — [FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md](FIRST_CITY_LEDGER_FINALIZER_TERRAIN_GAP.md) (`first_city_ledger_finalizer_terrain_gap`).
CITY_CREATION_RECOVERY §10 item 3 **remaining** (e.g. §7.10 finalizer commit-uncertain poison),
§10 items **5–7**, target-realm **drain/fence execution**,
native browser §11 — separate SPEC cards. Concurrent terminal ordering remains
[#2563](FIRST_CITY_LEDGER_RACE.md).
