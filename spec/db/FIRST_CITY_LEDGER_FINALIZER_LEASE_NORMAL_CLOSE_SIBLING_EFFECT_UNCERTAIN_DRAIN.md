# Sibling effect commit-uncertain gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-EFFECT-UNCERTAIN-DRAIN-001)

**Not** adopted. Task: [#2954](https://github.com/anitaguptaoffice/sanguo-slg/issues/2954). Stacks [#2948](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_COMMIT_UNCERTAIN_DRAIN.md) / [#2939](https://github.com/anitaguptaoffice/sanguo-slg/issues/2939). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.1/§8; complements [#2889](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNKNOWN_DRAIN.md) sibling simplified effect-unknown (no re-run) and [#2939](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNCERTAIN_DRAIN.md) head effect commit-uncertain (no re-run). Does not close #2737–#2948 Acceptance.

**Invariants:** head strict-classified + sibling `effect_ending=unknown` from commit-uncertain blocks `declare_drained` even when rollback evidence matches gate generation; cleanup alone ≠ drain; sibling resolved `known_rollback` + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_effect_uncertain_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.