# Finalizer receipt no source drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-RECEIPT-NO-SOURCE-DRAIN-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task:
[#2710](https://github.com/anitaguptaoffice/sanguo-slg/issues/2710). Stacks Draft
[#2707](https://github.com/anitaguptaoffice/sanguo-slg/pull/2707) /
[#2705](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.7 (竞争者 COMMIT ACK 丢失时
本 finalizer 不得解除 source drain); §11 **finalizer** row (竞争者 ACK-loss，不把单 receipt 当 source drain 证据).

## Why not other frozen cards

| Frozen elsewhere | This card |
|------------------|-----------|
| [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) simplified `writeReceipt` drain matrix | **Companion lock-order** terminal `COMMIT` on head command + sibling uncertain |
| [#2705](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md) own finalizer commit-uncertain poison | Committed terminal reject; competitor uncertain blocks drain |
| [#2579](FIRST_CITY_LEDGER_ACK_LOSS.md) competitor no double success | No harness `drain` / sibling uncertain binding |

Disposable `harness_source_gate` / `harness_command` tables are **fixture-only** (same pattern as
unknown drain / phase admission). **`player_city_id_seq` not activated**.

## Invariants (row evidence)

1. **Sibling uncertain:** While competitor `harness_command.ending = unknown`, this command’s
   companion-style finalizer `COMMIT` → sole `durable_state = 3` on this PK; `drain` stays `unresolved`;
   `try_declare_drained` fails.
2. **Competitor PG success + harness uncertain:** Competitor row may show `durable_state = 2` while
   harness still `unknown` → this finalizer reject must not set `drain = drained`.
3. **Receipt scope:** Terminal on this `command_id` only; sibling uncertain unchanged; new admission
   still rejected while `drain = unresolved`.

## Scenarios (harness minimum)

1. Sibling `unknown` + head finalizer reject `COMMIT` → drain `unresolved`, declare drained blocked.
2. Competitor success row + harness `unknown` + head finalizer reject → drain `unresolved`.
3. After (1): this command terminal; sibling still `unknown`; admission rejected.

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…/DISPOSABLE?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_receipt_no_source_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → harness `SKIP`, exit 0. Record `SHOW server_version` and each
`PASS finalizer_receipt_no_drain:` line.

## Follow-on

CITY_CREATION_RECOVERY §10 item 3 **remaining** after this slice (if any), §10 items **5–7**,
target-realm **drain/fence execution**, native browser §11 — separate SPEC cards. Concurrent terminal
ordering remains [#2563](FIRST_CITY_LEDGER_RACE.md).
