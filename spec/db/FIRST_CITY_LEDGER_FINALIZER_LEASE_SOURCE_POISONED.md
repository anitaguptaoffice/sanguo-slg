# Finalizer lease classify with poisoned source admission (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SOURCE-POISONED-001)

**Not** adopted or production-enabled. Task: [#2757](https://github.com/anitaguptaoffice/sanguo-slg/issues/2757). Stacks [#2754](FIRST_CITY_LEDGER_FINALIZER_LEASE_SIBLING_UNKNOWN.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4 item 4 + §8 (`admission=poisoned` → local cleanup must not classify lease `ended`). Not [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) drain matrix / not [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) Begin linearization / not [#2713](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md) stale-evidence SQL. Does not close #2737/#2739/#2744/#2747/#2753 Acceptance.

**Invariants:** (1) head ready + source poisoned → classify fail; (2) premature end fail; (3) source resolved open → classify ok.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_source_poisoned
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.

**Follow-on:** **SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-001** — [FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE.md) (`first_city_ledger_finalizer_lease_normal_close`); does not close #2737/#2739/#2744/#2747/#2753/#2757 Acceptance.