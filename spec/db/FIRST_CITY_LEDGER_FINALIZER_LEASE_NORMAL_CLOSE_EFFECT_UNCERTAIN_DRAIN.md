# Effect commit-uncertain gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-EFFECT-UNCERTAIN-DRAIN-001)

**Not** adopted. Task: [#2939](https://github.com/anitaguptaoffice/sanguo-slg/issues/2939). Stacks [#2935](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_STALE_EVIDENCE_DRAIN.md) / [#2934](https://github.com/anitaguptaoffice/sanguo-slg/issues/2934). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.1/§8; complements [#2718](FIRST_CITY_LEDGER_FINALIZER_EFFECT_UNCERTAIN_NO_PROOF.md) companion no-proof (no re-run) and [#2782](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNKNOWN_DRAIN.md) simplified effect-unknown drain (no re-run). Does not close #2737–#2934 Acceptance.

**Invariants:** after normal close, head `effect_ending=unknown` from commit-uncertain blocks `declare_drained` even when rollback evidence matches gate generation; cleanup alone ≠ drain; resolved `known_rollback` + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_effect_uncertain_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.