# Finalizer lease classify with unknown finalizer ending (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-FINALIZER-ENDING-UNKNOWN-001)

**Not** adopted or production-enabled. Task: [#2747](https://github.com/anitaguptaoffice/sanguo-slg/issues/2747). Stacks [#2746](https://github.com/anitaguptaoffice/sanguo-slg/pull/2746) / [#2744](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_PHASE.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4 item 4 + §7.10 (forbid classify `ended` while `finalizer_ending=unknown`). Complements [#2746](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_PHASE.md) phase timing; not [#2742](FIRST_CITY_LEDGER_FINALIZER_LEASE_TXN_BOUNDARY_UNKNOWN_ENDING.md) effect unknown. Does not close #2737 / #2739 / #2744 Acceptance.

## Invariants

1. `finalizer_ending=unknown`, phase clear → classify fails; lease `held`.
2. Same → premature end fails; PENDING unchanged.
3. Unknown → `known_terminal` + cleanup → classify may set `ended` (resolution path; not #2746 scene-3 re-run).

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_finalizer_ending_unknown
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. Record PG version and each `PASS finalizer_lease_finalizer_ending_unknown:` line.

**SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SIBLING-UNKNOWN-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md) (`first_city_ledger_finalizer_lease_sibling_unknown`); does not close #2737/#2739/#2744/#2747 Acceptance.

§10 item 3 **remaining** (if any), §10 **5–7**, realm drain/fence, browser §11 — separate cards.
