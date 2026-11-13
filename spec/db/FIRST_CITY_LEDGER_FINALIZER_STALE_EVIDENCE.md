# Finalizer stale rollback evidence gate (SPEC-FIRST-CITY-LEDGER-FINALIZER-STALE-EVIDENCE-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2713](https://github.com/anitaguptaoffice/sanguo-slg/issues/2713). Stacks Draft
[#2711](https://github.com/anitaguptaoffice/sanguo-slg/pull/2711) /
[#2710](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.5 (source drift /
sibling unknown poison → old failure evidence cannot start new finalizer SQL); §11 **lifecycle**
(source drift / no gate leak).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2710](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md) receipt≠source drain when sibling uncertain | Does not commit terminal to prove drain; blocks SQL when poison/drift |
| [#2705](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md) own finalizer commit-uncertain poison | Stale **prior** rollback evidence vs current gate generation |
| [#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) Begin/admission linearization | Executes companion finalizer **after** evidence+gate bind check |
| [#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md) whitelist / full rollback | Assumes healthy gate; no poison/drift matrix |

`harness_source_gate` / `harness_command` / `harness_rollback_evidence` are **fixture-only**.
**`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Poisoned source:** `admission=poisoned` + stale evidence → finalizer path `ROLLBACK`; command stays `PENDING`.
2. **Sibling unknown → poison:** Another command `ending=unknown` with gate poisoned → stale evidence cannot terminal-commit.
3. **Generation drift:** Evidence `bound_generation` ≠ gate `generation` → `ROLLBACK`, `PENDING`.
4. **Control:** `admission=open`, no sibling `unknown`, evidence generation match → sole `durable_state=3`, zero business rows.

## Scenarios (harness minimum)

1. Poisoned gate + evidence present → no terminal columns.
2. Sibling `unknown`, gate poisoned → no terminal.
3. Gate generation bumped, evidence stale → no terminal.
4. Healthy gate + matching evidence → committed reject reason `1`.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_stale_evidence
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_stale_evidence:` line.

## Follow-on

**SPEC-FIRST-CITY-LEDGER-FINALIZER-EFFECT-UNCERTAIN-NO-PROOF-001** —
[FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md)
(`first_city_ledger_finalizer_effect_uncertain_no_proof`). CITY_CREATION_RECOVERY §10 item 3 **remaining**
after that slice (if any), §10 items **5–7**, target-realm **drain/fence execution**, native browser §11 —
separate SPEC cards.
