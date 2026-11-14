# Finalizer lease classify under normal source close (SPEC-FIRST-CITY-LEDGER-FINALIZER-LEASE-NORMAL-CLOSE-001)

**Not** adopted or production-enabled. Stacks [#2758](FIRST_CITY_LEDGER_FINALIZER_LEASE_SOURCE_POISONED.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §7.4 item 4 + §8 (**正常 close** 下既有 held lease 可按已审 ending 收尾；`admission=closed` ≠ `poisoned` 阻断 classify)。互补 [#2757](https://github.com/anitaguptaoffice/sanguo-slg/issues/2757) poisoned 阻断。不重跑 [#2575](FIRST_CITY_LEDGER_PHASE_ADMISSION.md) 五场景 / [#2577](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) drain 矩阵。不闭合 #2737/#2739/#2744/#2747/#2753/#2757 Acceptance。

**Invariants:** (1) head ready + `admission=closed` → classify ok; (2) close + premature end fail; (3) close + cleanup before head ready → classify fail。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…?sslmode=disable' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_finalizer_lease_normal_close
```

No DSN / `ALLOW_OWNED_PG17_TEST` → `SKIP`, exit 0. **Follow-on:** [NORMAL-CLOSE-DRAIN-001](FIRST_CITY_LEDGER_FINALIZER_LEASE_NORMAL_CLOSE_DRAIN.md) (`first_city_ledger_finalizer_lease_normal_close_drain`); does not close #2737/#2739/#2744/#2747/#2753/#2757/#2761 Acceptance.