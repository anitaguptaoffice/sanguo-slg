# Sibling finalizer ending unknown gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-ENDING-UNKNOWN-DRAIN-001)

**Not** adopted. Task: [#2854](https://github.com/anitaguptaoffice/sanguo-slg/issues/2854). Stacks [#2849](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2792/#2830/#2848 (no re-run). Does not close #2737–#2848 Acceptance.

**Invariants:** head strict-classified + sibling `finalizer_ending=unknown` blocks `declare_drained`; cleanup ≠ drain; sibling `known_terminal` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_ending_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.