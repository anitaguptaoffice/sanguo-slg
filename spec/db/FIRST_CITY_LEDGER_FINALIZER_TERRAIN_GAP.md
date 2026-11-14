# Finalizer inter-gap terrain flip (SPEC-FIRST-CITY-LEDGER-FINALIZER-TERRAIN-GAP-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2701](https://github.com/anitaguptaoffice/sanguo-slg/issues/2701). Stacks Draft
[#2698](https://github.com/anitaguptaoffice/sanguo-slg/pull/2698) /
[#2697](FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.8 (间隙坐标变可用时仍可终结
**该次**失败尝试；rejection 不声称实时 buildability)；§11 **finalizer** row（间隙地形变可用）；
[FIRST_CITY_LEDGER_PG_COMPANION.md](FIRST_CITY_LEDGER_PG_COMPANION.md) §5.2 live terrain `FOR SHARE` 重读.

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) live-only `evidence_mismatch_buildable_claims_terrain` | Same-session flip; not **inter-session gap** narrative + §7.8 bound branch |
| [#2697](FIRST_CITY_LEDGER_FINALIZER_ACCOUNT_BLOCK.md) ACCOUNT/binding fail-closed | Terrain gap only |
| [#2689](FIRST_CITY_LEDGER_CRASH_GAP.md) rollback→finalizer session crash | No terrain flip matrix |
| [#2563](FIRST_CITY_LEDGER_RACE.md) PK terminal race | Minimal effect-wins cross-check in gap context only |

Harness **branch evidence** simulates §7.8 in-process provenance (not serialized); **`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Gap + live re-read only:** Effect left `PENDING` on non-buildable terrain; before finalizer,
   `map_cell.terrain` becomes buildable (`4`) → reason `1` without bound branch → `ROLLBACK`; row stays
   `durable_state=1`.
2. **Gap + bound branch:** Same flip; finalizer holds disposable proof that reason `1` branch was taken at
   effect time on non-buildable terrain → may `COMMIT` `durable_state=3`/`rejection_reason=1`; zero business
   rows; live cell may still be buildable after commit (rejection does not claim permanent unbuildable).
3. **Effect wins in gap:** After flip to buildable, effect path commits `durable_state=2` first → finalizer
   reject `ROLLBACK`; observer sole `2`.

## Scenarios (harness minimum)

1. Flip to buildable; live-only reason `1` → `ROLLBACK`, PENDING.
2. Flip to buildable; bound branch reason `1` → `COMMIT` reject; terrain still buildable on readback.
3. Effect success after flip → finalizer blocked; state `2`.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_terrain_gap
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_terrain_gap:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-COMMIT-UNCERTAIN-POISON-001** —
[FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md)
(`first_city_ledger_finalizer_commit_uncertain_poison`). CITY_CREATION_RECOVERY §10 item 3 **remaining** after that
slice (if any), §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
