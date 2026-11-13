# Online exclusion / last-txn drain (SPEC-FIRST-CITY-LEDGER-ONLINE-EXCLUSION-001)

**Not** deployed, realm-enrolled, cutover-enabled, or production-enabled. [#2591](https://github.com/anitaguptaoffice/sanguo-slg/issues/2591); stacks [#2590](FIRST_CITY_LEDGER_MAPPING_FENCE.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §9、§11 retention/cutover 行中可在隔离 PG17 上证明的旧连接、直接 SQL、独立 `nextval`/`setval` 排他与贯穿末活跃事务的外部排空；[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2；[#2590](FIRST_CITY_LEDGER_MAPPING_FENCE.md) 五条不重跑。

Disposable PG17：夹具 `harness_*`（非生产 DDL；`harness_city_queue_alloc_seq` 非 `player_city_id_seq`）；第二条 TCP 作独立观察者。

| 场景 | 证明要点 |
|------|----------|
| 旧连接未提交事务 | 排他下 bypass 不得留下可见首次建城；保留行与命令数不变 |
| 直接 SQL | 伪造 command/receipt 触发器拒绝 |
| nextval/setval | `harness_city_alloc` 排他期拒绝；观察者无新首次 command |
| 末事务假排空 | 持锁时 `local_drain_counter` 不能解锁 EMPTY；真实结束后方可 lawful intake（不重跑 #2590） |
| 合法多城 | mapping+fence 有效时额外 `player_city` 可写 |

**Out of scope:** #2590/#2588/#2586/#2584 已冻场景；生产旧 writer/rollback binary、realm 认证、drain/fence 生产控制器、WS/浏览器、`fresh_admission.go`、生产 fence/cutover/部署。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_online_exclusion
```

记录 `SHOW server_version` 与各 `PASS online_exclusion:`。Follow-on：§11 browser、生产旧 binary 在线排他、realm 认证、生产 drain/fence 控制器 — 另卡。
