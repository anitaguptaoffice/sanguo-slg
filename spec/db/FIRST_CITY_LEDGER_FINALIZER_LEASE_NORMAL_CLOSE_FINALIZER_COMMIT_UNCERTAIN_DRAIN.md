# Finalizer commit-uncertain gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-FINALIZER-COMMIT-UNCERTAIN-DRAIN-001)

**Not** adopted. Task: [#2944](https://github.com/anitaguptaoffice/sanguo-slg/issues/2944). Stacks [#2941](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNCERTAIN_DRAIN.md) / [#2939](https://github.com/anitaguptaoffice/sanguo-slg/issues/2939). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.10/§8; complements [#2705](FIRST_CITY_LEDGER_FINALIZER_COMMIT_UNCERTAIN_POISON.md) companion poison (no re-run) and [#2792](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_ENDING_UNKNOWN_DRAIN.md) simplified finalizer-unknown drain (no re-run). Does not close #2737–#2939 Acceptance.

**Invariants:** after normal close + effect `known_rollback`, head `finalizer_ending=unknown` from commit-uncertain blocks `declare_drained` even when rollback evidence matches gate generation; cleanup alone ≠ drain; resolved `known_terminal` + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_finalizer_commit_uncertain_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [SIBLING-FINALIZER-COMMIT-UNCERTAIN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_COMMIT_UNCERTAIN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_commit_uncertain_drain`); stacks #2948 / #2944; does not close #2737–#2944 Acceptance.