# Effect rollback→finalizer crash gap (SPEC-FIRST-CITY-LEDGER-CRASH-GAP-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2689](https://github.com/anitaguptaoffice/sanguo-slg/issues/2689). Stacks Draft
[#2686](https://github.com/anitaguptaoffice/sanguo-slg/pull/2686) /
[#2685](FIRST_CITY_LEDGER_PLAYER_CITY_ID_SEQ.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.9 item 9
(rollback 后、finalizer 前 crash 留下 PENDING), §11 **finalizer** row (crash gap 保留 PENDING；
伪造错误/跨 tx proof/日志不能拒绝).

## Why not ATOMICITY ([#2581](https://github.com/anitaguptaoffice/sanguo-slg/issues/2581))

[SPEC-FIRST-CITY-LEDGER-ATOMICITY-001](FIRST_CITY_LEDGER_ATOMICITY.md) freezes
**single-writer, single-session** per-barrier effect-transaction rollback (wallet / WORLD / MIL /
DOM / receipt). That card is the follow-on **Crash barriers** matrix — **not re-run here**.
This card freezes **cross-connection / session-end** readback after a confirmed effect `ROLLBACK`
**before** any finalizer attempt.

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2581](FIRST_CITY_LEDGER_ATOMICITY.md) same-session barrier rollback | Writer pool closes; **new** observer pool |
| [#2579](FIRST_CITY_LEDGER_ACK_LOSS.md) intake/effect/finalizer ack-loss | Not COMMIT-uncertainty; confirmed rollback gap |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist finalizer SQL | Only proves gap stays PENDING without that path |

Fixture `city_id=88001`; **`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Gap readback:** After effect txn `ROLLBACK` and writer disconnect, observer sees
   `durable_state=1`, zero committed wallet/CITY/MIL/DOM for the attempt, no terminal columns.
2. **No log-as-terminal:** A separate connection must not durably commit `durable_state=3` from a
   blind `rejection_reason=1` update without the frozen whitelist/evidence chain (txn ends in
   `ROLLBACK`; observer still PENDING).
3. **Continuation allowed:** After the gap, a new session may still `COMMIT` a full success path
   for the same command PK (proves gap ≠ rejection).

## Scenarios (harness minimum)

1. Staged wallet+WORLD effect, `ROLLBACK`, writer closed → new observer PENDING, `bizSum=0`.
2. Staged through DOM, `ROLLBACK` before `COMMIT` → new observer PENDING, `bizSum=0`.
3. New session blind terminal `UPDATE` in txn → `ROLLBACK` → observer PENDING, no terminal columns.
4. After scenario 1 gap state, new session runs complete effect + success receipt → one success city.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_crash_gap
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS crash_gap:` line.

## Follow-on

CITY_CREATION_RECOVERY §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 —
separate SPEC cards. Per-barrier crash barriers remain [#2581](FIRST_CITY_LEDGER_ATOMICITY.md).
