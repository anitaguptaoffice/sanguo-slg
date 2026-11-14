# Finalizer lease classify with unknown effect ending (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-UNKNOWN-ENDING-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2739](https://github.com/anitaguptaoffice/sanguo-slg/issues/2739). Stacks Draft
[#2738](https://github.com/anitaguptaoffice/sanguo-slg/pull/2738) /
[#2737](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4
(generation-bound lease; **forbidden:** classify lease `ended` or advance finalizer while
`effect_ending=unknown`; discard private context, keep PENDING until ending is known);
§10 item 3 slice after [#2738](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2738](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md) open txn + known_rollback control | **`effect_ending=unknown`** independent row evidence only |
| [#2718](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md) rollback proof whitelist | Lease **classification** timing, not evidence matrix |
| [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) admission/Begin linearization | Disposable gate/lease + effect_txn unknown-ending only |

Harness tables are **disposable-fixture only**. `player_city_id_seq` not activated.

Does **not** close [#2737](https://github.com/anitaguptaoffice/sanguo-slg/issues/2737) Acceptance in full; only adds missing unknown-ending `PASS` lines.

## Invariants (row evidence)

1. **Unknown ending:** While `effect_ending=unknown` (even if `txn_open=false`), `tryClassifyLeaseEnded` must fail; command stays `durable_state=1`.
2. **Unknown premature end:** Same state → unsafe `endLease` classify attempt must fail; lease `held`.
3. **Open txn finalizer block:** While `txn_open=true`, `finalizer_begin` must fail without a recorded rollback boundary (negative control; not a re-run of [#2738](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md) cleanup scenario).

## Scenarios (harness minimum)

1. Close effect txn as `unknown` → cleanup bump → classify rejected → lease `held`, PENDING.
2. Same fixture → premature `endLease` rejected → still `held`, PENDING.
3. Open txn after `effect_begin` → `finalizer_begin` rejected → PENDING.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary_unknown_ending
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_lease_txn_boundary_unknown_ending:` line.

## Follow-on

CITY_CREATION_RECOVERY §10 item 3 **remaining** after this slice (if any), §10 items **5–7**,
target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
