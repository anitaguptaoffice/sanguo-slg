# Sibling effect ending unknown gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-UNKNOWN-DRAIN-001)

**Not** adopted. Task: [#2848](https://github.com/anitaguptaoffice/sanguo-slg/issues/2848). Stacks [#2843](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_TXN_OPEN_DRAIN.md). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4/§8; complements #2788/#2834/#2841 (no re-run). Does not close #2737–#2841 Acceptance.

**Invariants:** head strict-classified + sibling `txn_open=false` with `effect_ending=unknown` blocks `declare_drained`; cleanup ≠ drain; sibling `effect_ending=known_rollback` → drain + generation++.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_unknown_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.