# Finalizer lease classify with sibling command unknown (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-SIBLING-UNKNOWN-001)

**Not** adopted or production-enabled. Task: [#2753](https://github.com/anitaguptaoffice/sanguo-slg/issues/2753). Stacks [#2750](FIRST_CITY_LEDGER_FINALIZER_LEASE_FINALIZER_ENDING_UNKNOWN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; not [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) / [#2710](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md) re-run. Does not close #2737/#2739/#2744/#2747 Acceptance.

**Invariants:** (1) head ready + sibling `unknown` → classify fail; (2) premature end fail; (3) sibling resolved → classify ok.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_sibling_unknown
```
No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.