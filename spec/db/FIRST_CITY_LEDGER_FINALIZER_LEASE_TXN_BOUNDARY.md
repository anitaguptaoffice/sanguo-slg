# Finalizer lease classify after effect txn boundary (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2737](https://github.com/anitaguptaoffice/sanguo-slg/issues/2737). Stacks Draft
[#2732](https://github.com/anitaguptaoffice/sanguo-slg/pull/2732) /
[#2731](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4
(generation-bound lease; **forbidden:** classify lease `ended` or advance finalizer while the
bound effect transaction is still open or ending is unknown; discard private context, keep PENDING
until txn boundary + bounded cleanup); §10 item 3 slice after
[#2731](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2731](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md) same lease across effect rollback→finalizer | **When** lease may be classified `ended` vs effect txn still open |
| [#2718](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md) no rollback proof from uncertain commit | Lease **classification** timing, not evidence whitelist |
| [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) admission/Begin linearization | Disposable gate/lease + effect_txn boundary only |

Harness tables are **disposable-fixture only**. `player_city_id_seq` not activated.

## Invariants (row evidence)

1. **Open txn:** While `harness_effect_txn.txn_open=true`, bounded cleanup must not flip lease to `ended`; command stays `durable_state=1`.
2. **Unknown ending:** While `effect_ending=unknown`, `tryClassifyLeaseEnded` must fail; PENDING unchanged.
3. **Known rollback boundary:** After `txn_open=false` and `effect_rollback_at` on the lease, `finalizer_begin` on the **same** lease may commit (control).

## Scenarios (harness minimum)

1. `effect_begin` + open txn → cleanup bump + classify attempt rejected → lease `held`, PENDING.
2. Open txn → premature `endLease` rejected → still `held`.
3. Close txn as `known_rollback` + record rollback → `finalizer_begin` on same lease succeeds.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_txn_boundary
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_lease_txn_boundary:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-TXN-BOUNDARY-UNKNOWN-ENDING-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md); §7.4 `effect_ending=unknown` lease classify (`first_city_ledger_finalizer_lease_txn_boundary_unknown_ending`); does not close [#2737](https://github.com/anitaguptaoffice/sanguo-slg/issues/2737) Acceptance in full.

CITY_CREATION_RECOVERY §10 item 3 **remaining** after that slice (if any), §10 items **5–7**,
target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
