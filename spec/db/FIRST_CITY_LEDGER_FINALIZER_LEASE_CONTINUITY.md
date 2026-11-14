# Finalizer generation-bound lease continuity (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-CONTINUITY-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2731](https://github.com/anitaguptaoffice/sanguo-slg/issues/2731). Stacks Draft
[#2727](https://github.com/anitaguptaoffice/sanguo-slg/pull/2727) /
[#2726](FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4 item 4
(generation-bound command lease must cover effect Begin/rollback, the gap, and finalizer Begin;
**forbidden:** mark lease `ended` after effect rollback, then Begin finalizer **without** a new admitted
lease); §11 **finalizer** row (competitor txn wait is [#2563](FIRST_CITY_LEDGER_RACE.md), not re-run here).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) close/poison / check-then-Begin linearization | Same-generation **lease must stay `held` across effect rollback→finalizer Begin** |
| [#2689](FIRST_CITY_LEDGER_CRASH_GAP.md) session-end PENDING gap | Lease row continuity, not cross-connection command reread |
| [#2726](FIRST_CITY_LEDGER_FINALIZER_PRESERVE_TERMINAL.md) terminal immutability | Lease discipline before any terminal `UPDATE` |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist SQL | Harness records lease phases only |

Harness **`harness_source_gate` / `harness_lease`** tables are **disposable-fixture only** (same pattern as
phase-admission cards). **`player_city_id_seq` not activated.**

## Invariants (row evidence)

1. **Continuous lease:** After `effect_begin` and a recorded effect rollback on generation *G*, the **same**
   `lease_id` remains `status=held` and may linearize `finalizer_begin` on *G* while admission is `open`.
2. **Premature end forbidden:** If the lease is marked `ended` after effect rollback, `finalizer_begin` on that
   `lease_id` must fail; a **new** lease requires a fresh admitted generation.
3. **Control:** Fresh admission after premature end may `finalizer_begin` on the **new** lease only.

## Scenarios (harness minimum)

1. `effect_begin` → record effect rollback → `finalizer_begin` on same lease (committed).
2. `effect_begin` → rollback → premature `ended` → `finalizer_begin` rejected on same lease; command may stay PENDING.
3. After (2), new admitted lease → `finalizer_begin` succeeds (control).

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_continuity
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_lease_continuity:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md); §7.4 lease classify only after effect txn boundary (`first_city_ledger_finalizer_lease_txn_boundary`).

CITY_CREATION_RECOVERY §10 item 3 **remaining** after that slice (if any), §10 items **5–7**,
target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
