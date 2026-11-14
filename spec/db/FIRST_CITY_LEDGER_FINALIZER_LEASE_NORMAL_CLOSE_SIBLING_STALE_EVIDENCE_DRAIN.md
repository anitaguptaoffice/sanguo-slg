# Sibling stale rollback evidence gates drain (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-SIBLING-STALE-EVIDENCE-DRAIN-001)

**Not** adopted. Task: [#2960](https://github.com/anitaguptaoffice/sanguo-slg/issues/2960). Stacks [#2954](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_UNCERTAIN_DRAIN.md) / [#2934](https://github.com/anitaguptaoffice/sanguo-slg/issues/2934). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.5/§8; complements [#2713](FIRST_CITY_LEDGER_FINALIZER_STALE_EVIDENCE.md) companion gate (no re-run) and [#2934](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_STALE_EVIDENCE_DRAIN.md) head-only stale evidence drain (no re-run). Does not close #2737–#2954 Acceptance.

**Invariants:** head strict-classified + head evidence aligned with gate `generation` but sibling `harness_rollback_evidence.bound_generation` ≠ gate `generation` blocks `declare_drained`; cleanup alone ≠ drain; sibling evidence aligned + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_sibling_stale_evidence_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [NOT-CURRENT-HEAD-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_NOT_CURRENT_HEAD_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_not_current_head_drain`); stacks #2966 / #2960; does not close #2737–#2960 Acceptance (#2722 companion frozen separately).