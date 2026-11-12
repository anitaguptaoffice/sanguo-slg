# Unknown drain matrix (SPEC-FIRST-CITY-LEDGER-UNKNOWN-DRAIN-001)

**Not** adopted, deployed, realm-enrolled, or production-enabled. Task:
[#2577](https://github.com/anitaguptaoffice/sanguo-slg/issues/2577). Stacks
[#2576](https://github.com/anitaguptaoffice/sanguo-slg/pull/2576) /
[#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md). Depends on
[CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.5 item 7, §8;
[FRESH_CITY_PARTICIPANTS.md](../rules/FRESH_CITY_PARTICIPANTS.md) §2;
[#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) (phase admission / lease / close-poison;
unchanged here).

## Purpose

Freeze **unknown drain physical thresholds** on disposable **PostgreSQL 17** with
independent connections, real transactions, and **readable row snapshots** of
`harness_source_gate` / lease / per-command ending state — not error codes, log tags,
receipt return values, or local cleanup counters alone.

| Invariant | Requirement |
|-----------|-------------|
| **Receipt ≠ source drain** | A single command terminal receipt (`SUCCEEDED` / `REJECTED_NO_EFFECT`) explains only that command; it must not mark the source `drained`, clear source-wide unknown, or lift admission rejection while poison/unresolved. |
| **Unknown not cleared locally** | Commit/rollback ending unknown → poison/close; `drain = unresolved`. Local lease release, cancel, timeout, or `cleanup_attempts++` alone does not prove PostgreSQL ended; must not flip drain to `drained`. |
| **Sibling unknown / drift** | While another command on the same source has `ending = unknown`, or source is poisoned, this command’s receipt must not complete drain or admit new lease/Begin. |
| **Normal close completion** | Close stops new admission only. Drain completes only after **every** admitted lease is `ended` and **every** command ending is known (not `unknown` / `pending`). |
| **Drained → new generation** | After normal close + confirmed drain, only a **new** generation may `try_acquire_admission`; prior generation stays closed (no online reopen). Poisoned / `unresolved` generations must not take this continuation path. |

**Non-goals:** [#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) five scenarios (not re-run);
[#2574](FIRST_CITY_LEDGER_FINALIZER_ROLLBACK.md); process restart / ACK-loss; online
reopen / `clear unknown` API; realm drain/fence; `internal/api/fresh_admission.go`;
realm certification; playable-first-city product acceptance.

## Boundaries

| Frozen elsewhere | This card |
|------------------|-----------|
| Phase admission / Begin linearization [#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) | Drain completion vs receipt; multi-command unknown; post-drain generation continue |
| `m4_010` / production DDL | Harness tables **disposable-fixture only** (test schema) |
| CITY_CREATION_RECOVERY §10 items 5–7, §11 full matrix | Out of scope |

## Scenarios (harness minimum)

1. Poison + terminal receipt on one command → `drain` stays `unresolved`; new admission / Begin rejected.
2. Sibling command `ending = unknown` → this command receipt → source not `drained`; admission still rejected.
3. After unknown ending: lease release / cancel flag / cleanup bump → `drain` stays `unresolved`.
4. Normal close: held lease blocks `try_declare_drained`; after known end → `drained` allowed.
5. After drained: new generation admits; old generation cannot reopen; poisoned source cannot advance via drain path.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_unknown_drain
```

Record actual `SHOW server_version` and per-scenario `PASS` lines.

## Follow-on

Process restart / ACK-loss, realm drain/fence, production admission controller,
CITY_CREATION_RECOVERY §10 items 5–7 — separate cards. Phase admission remains
[#2576](FIRST_CITY_LEDGER_PHASE_ADMISSION.md).
