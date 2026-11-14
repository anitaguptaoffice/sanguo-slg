# Finalizer phase before lease classify (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-PHASE-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2744](https://github.com/anitaguptaoffice/sanguo-slg/issues/2744). Stacks Draft
[#2742](https://github.com/anitaguptaoffice/sanguo-slg/pull/2742) /
[#2742](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4 item 4
(lease covers **finalizer Begin/ending** + bounded cleanup; forbid classify `ended` while finalizer incomplete);
§10 item 3 slice after [#2742](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md).

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2738](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY.md) open txn / known_rollback→finalizer_begin | Finalizer **ending** vs lease classify |
| [#2742](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md) `effect_ending=unknown` | Not effect txn boundary re-run |
| [#2731](FIRST_CITY_LEDGER_FINALIZER_LEASE_CONTINUITY.md) premature `ended` after rollback | Classify timing after rollback path |

Harness tables are **disposable-fixture only**. `player_city_id_seq` not activated.
Does **not** close [#2737](https://github.com/anitaguptaoffice/sanguo-slg/issues/2737) or [#2739](https://github.com/anitaguptaoffice/sanguo-slg/issues/2739) Acceptance.

## Invariants (row evidence)

1. **Gap before finalizer_begin:** `known_rollback` closed, `effect_rollback_at` set, no finalizer yet → classify fails; lease `held`.
2. **In-flight finalizer_begin:** `phase='finalizer_begin'` → classify fails; `durable_state=1`.
3. **Control:** `finalizer_ending=known_terminal`, phase cleared, bounded cleanup → classify may set `ended`.

## Scenarios

1. Effect rollback recorded → classify rejected (no finalizer).
2. `finalizer_begin` in flight → classify rejected.
3. Finalizer terminal + cleanup → classify succeeds.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_finalizer_phase
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. Record `SHOW server_version` and each `PASS finalizer_lease_finalizer_phase:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-ENDING-UNKNOWN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md) (`first_city_ledger_finalizer_lease_finalizer_ending_unknown`); does not close #2737/#2739/#2744 Acceptance.

§10 item 3 **remaining** after that slice (if any), §10 items **5–7**, realm drain/fence execution, browser §11 — separate SPEC cards.
