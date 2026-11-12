# Narrow rejection finalizer rollback (SPEC-FIRST-CITY-LEDGER-FINALIZER-ROLLBACK-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. Task:
[#2573](https://github.com/anitaguptaoffice/sanguo-slg/issues/2573). Stacks
[#2572](https://github.com/anitaguptaoffice/sanguo-slg/pull/2572).
Depends on [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §10 item 3 (first slice),
[FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) (pseudo-errors / cleanup counts are not authoritative
termination), [FIRST-CITY-WIRE.md](../proto/FIRST-CITY-WIRE.md) (`rejection_reason` 1/2),
[FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5 (lock modes and SQL sequence unchanged here).

## Purpose

Freeze **narrow rejection finalizer** (`durable_state = 3`) invariants proved on disposable **PostgreSQL 17** with
real transactions and row snapshots — not SQL error text, mocks, or cleanup counters alone:

| Invariant | Requirement |
|-----------|-------------|
| **Full rollback** | No `INSERT`/`UPDATE` on `player_wallet`, `player_city`, MIL/DOM init for this attempt; companion §4.1 steps 3–6 forbidden. |
| **Whitelist branch** | `rejection_reason = 1` only if `map_cell` evidence at C1 is still non-buildable; `2` only if a committed `player_city` occupier exists at the coordinate — must match the **same-attempt** `FOR SHARE` re-read. |
| **Reject without terminal** | If whitelist fails or proposed reason disagrees with evidence → `ROLLBACK`; command stays `PENDING` (`durable_state=1`); `terminal_at` / `rejection_reason` must not appear committed. |
| **Exact-attempt** | Zero-row `UPDATE … AND durable_state=1`, or `ROLLBACK` before terminal `UPDATE`, is **not** authoritative termination; row evidence must still show `PENDING` without stray terminal columns. |

**Non-goals:** re-proving [#2563](FIRST_CITY_LEDGER_RACE.md) effect/finalizer race matrix; rewriting companion §5 SQL or lock modes;
phase admission/lease/close/poison, Begin linearization, unknown drain, ACL, `validate_only` GUC, `player_city_id_seq`,
CITY_CREATION_RECOVERY §10 items 5–7, realm drain/fence, full §11 matrix; runtime/API/client/proto changes; realm
certification or playable-first-city product acceptance.

## Boundaries

| Frozen elsewhere | This card |
|------------------|-----------|
| §5.3 concurrent winner/loser on one PK ([#2563](FIRST_CITY_LEDGER_RACE.md)) | Single-writer finalizer paths; no concurrent effect/finalizer race grid |
| Full effect-path business rows ([#2566](FIRST_CITY_LEDGER_EFFECT_PATH.md)) | Zero net business mutation on successful reject |
| Companion §5 SQL / §5.1 lock table | Harness **executes** that sequence; does not edit companion body |

Fixture buildability matches disposable effect-path tests: `map_cell.terrain = 4` is buildable; any other sampled value is
non-buildable for reason `1`. `success_city_id` / test `city_id` constants only; **`player_city_id_seq` not activated**.

## Scenarios (harness minimum)

1. Reason `1` + non-buildable terrain → sole `durable_state=3`, `rejection_reason=1`, no business rows.
2. Reason `2` + committed occupier at C1 → `durable_state=3`, `rejection_reason=2`, no business rows for player 42.
3. Buildable + unoccupied → full `ROLLBACK`, still `PENDING`.
4. Proposed reason disagrees with evidence (e.g. buildable terrain + reason `1`) → `ROLLBACK`, still `PENDING`.
5. Zero-row terminal `UPDATE` (wrong scope) after locks → `ROLLBACK`, still `PENDING`.
6. `ROLLBACK` after evidence re-read, before terminal `UPDATE` → still `PENDING`, no partial terminal columns.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_rollback
```

Record actual `SHOW server_version` and per-scenario `PASS` lines from harness output.

## Follow-on

CITY_CREATION_RECOVERY §10 item 3 **remaining** slice: continuous command lease, normal close vs poison, phase admission /
Begin linearization, cleanup and unknown drain — separate SPEC cards. Concurrent effect/finalizer ordering remains
[#2563](FIRST_CITY_LEDGER_RACE.md).
