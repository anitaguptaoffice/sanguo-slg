# Head terminal receipt must not source-drain under normal close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-RECEIPT-NO-SOURCE-DRAIN-001)

**Not** adopted. Task: [#2927](https://github.com/anitaguptaoffice/sanguo-slg/issues/2927). Stacks [#2924](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_SIBLING_EFFECT_BEGIN_DRAIN.md) / [#2869](https://github.com/anitaguptaoffice/sanguo-slg/issues/2869). Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.7/§8; complements [#2710](FIRST_CITY_LEDGER_FINALIZER_RECEIPT_NO_SOURCE_DRAIN.md) companion receipt≠drain (no full strict classify re-run) and #2869–#2924 sibling/head normal-close drain slices (no re-run). Does not close #2737–#2869 Acceptance.

**Invariants:** after normal close + head strict-classified, companion `world_first_city_command` finalizer terminal `COMMIT` on head must not `declare_drained` while any command `ending=unknown` (including competitor PG `SUCCEEDED` + harness uncertain); cleanup ≠ drain; all command endings known + strict classify → drain + `generation++`.

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close_receipt_no_source_drain
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [STALE-EVIDENCE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_STALE_EVIDENCE_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_stale_evidence_drain`); stacks #2934 / #2927; does not close #2737–#2927 Acceptance (#2713 companion frozen separately).