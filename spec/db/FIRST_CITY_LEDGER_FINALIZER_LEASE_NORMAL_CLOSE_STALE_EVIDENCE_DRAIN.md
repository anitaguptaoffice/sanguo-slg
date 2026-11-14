# Stale rollback evidence gates drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-STALE-EVIDENCE-DRAIN-001)

**Not** adopted. Task: [#2934](https://github.com/anitaguptaoffice/sanguo-slg/issues/2934). Stacks [#2929](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_RECEIPT_NO_SOURCE_DRAIN.md) / [#2927](https://github.com/anitaguptaoffice/sanguo-slg/issues/2927). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.5/§8; complements [#2713](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md) companion SQL gate (no re-run) and #2778 poisoned-admission drain (no re-run). Does not close #2737–#2927 Acceptance.

**Invariants:** after normal close + head strict-classified + all command endings known, any `harness_rollback_evidence.bound_generation` ≠ gate `generation` blocks `declare_drained`; cleanup alone ≠ drain; matching evidence → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_stale_evidence_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [EFFECT-UNCERTAIN-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_EFFECT_UNCERTAIN_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_effect_uncertain_drain`); stacks #2939 / #2934; does not close #2737–#2934 Acceptance (#2718 companion frozen separately).