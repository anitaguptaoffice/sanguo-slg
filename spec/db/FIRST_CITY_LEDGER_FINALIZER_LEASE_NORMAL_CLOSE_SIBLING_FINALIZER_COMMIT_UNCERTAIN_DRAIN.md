# Sibling finalizer commit-uncertain gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-FINALIZER-COMMIT-UNCERTAIN-DRAIN-001)

**Not** adopted. Task: [#2948](https://github.com/anitaguptaoffice/sanguo-slg/issues/2948). Stacks [#2946](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_COMMIT_UNCERTAIN_DRAIN.md) / [#2944](https://github.com/anitaguptaoffice/sanguo-slg/issues/2944). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.10/§8; complements [#2854](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_FINALIZER_ENDING_UNKNOWN_DRAIN.md) sibling simplified finalizer-unknown (no re-run) and [#2946](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_FINALIZER_COMMIT_UNCERTAIN_DRAIN.md) head commit-uncertain (no re-run). Does not close #2737–#2944 Acceptance.

**Invariants:** head strict-classified + sibling effect `known_rollback` with `finalizer_ending=unknown` from commit-uncertain blocks `declare_drained` even when rollback evidence matches gate generation; cleanup alone ≠ drain; sibling resolved `known_terminal` + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_finalizer_commit_uncertain_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0.