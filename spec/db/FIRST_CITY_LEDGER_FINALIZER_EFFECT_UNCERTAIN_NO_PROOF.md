# Effect commit-uncertain cannot authorize narrow finalizer proof (SPEC-FIRST-CITY-LEDGER-FINALIZER-EFFECT-UNCERTAIN-NO-PROOF-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2718](https://github.com/anitaguptaoffice/sanguo-slg/issues/2718). Stacks Draft
[#2715](https://github.com/anitaguptaoffice/sanguo-slg/pull/2715) /
[#2713](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.1 (effect attempted `COMMIT`
with uncertain ending → later `ROLLBACK`/cleanup must **not** establish no-effect proof for narrow
finalizer); §7.10 item (intake uncertain `COMMIT` poisons; reading `PENDING` must not bypass poisoned
generation); §8 (unknown effect ending poisons admission).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2713](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md) poison/drift/evidence generation | Effect **attempt** ending `unknown` invalidates in-process rollback proof |
| [#2705](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md) **finalizer** terminal commit-uncertain | Effect/intake commit-uncertain **before** finalizer path |
| [#2689](FIRST_CITY_LEDGER_CRASH_GAP.md) confirmed effect `ROLLBACK` gap | Uncertain commit attempt; cleanup after uncertain |
| [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) generic gate linearization | Narrow finalizer **rollback proof** gate on `harness_effect_ending` |
| [#2581](FIRST_CITY_LEDGER_ATOMICITY.md) same-session barrier rollback | Cross-step effect ending vs finalizer evidence bind |

`harness_source_gate` / `harness_effect_ending` / `harness_rollback_evidence` are **fixture-only**.
**`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Effect commit-uncertain:** Effect transaction reaches uncertain ending → gate `poisoned`, fixture
   `effect_ending=unknown`; command stays `PENDING`, zero committed business rows.
2. **No proof after uncertain:** In-process rollback evidence after uncertain ending must not authorize
   terminal `UPDATE`; observer `PENDING`, `bizSum=0`.
3. **Intake uncertain:** Intake commit-uncertain poisons gate; `PENDING` read cannot bypass finalizer block.
4. **Control:** `effect_ending=known_rollback` + open gate → sole `durable_state=3`, zero business rows.

## Scenarios (harness minimum)

1. Effect uncertain attempt + post-hoc evidence → no terminal; `bizSum=0`.
2. Intake uncertain poison → `PENDING` read, no finalizer `COMMIT`.
3. Known rollback + healthy gate → committed reject reason `1`.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_effect_uncertain_no_proof
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_effect_uncertain:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-NOT-CURRENT-HEAD-001** —
[FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md](FIRST_CITY_LEDGER_FINALIZER_NOT_CURRENT_HEAD.md)
(`first_city_ledger_finalizer_not_current_head`). CITY_CREATION_RECOVERY §10 item 3 **remaining** after that
slice (if any), §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 — separate SPEC cards.
