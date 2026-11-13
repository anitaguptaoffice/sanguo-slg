# Physical mapping / fence fail-closed (SPEC-FIRST-CITY-LEDGER-MAPPING-FENCE-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task [#2589](https://github.com/anitaguptaoffice/sanguo-slg/issues/2589); stacks [#2588](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §9、§11 retention/cutover 可隔离映射/fence 证明；[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2 ID retention。

Disposable PG17：`harness_mapping_fence_realm` + command/slot/提案可读行；独立观察者（同池已提交读）。

## In scope (this card only)

| Obligation | Harness proof |
|------------|----------------|
| 缺失物理映射 | 无 cluster/database/schema/shard·actor/allocator/账户绑定/writer authority 映射时不得 EMPTY INITIAL；不得补写 receipt；观察者无新首次命令 |
| 仅 namespace 标签 | 只有 ledger namespace 字符串、无物理映射时不得视为已隔离；fail closed |
| 残缺 / 矛盾 / 过期映射 | 缺段或 cluster·schema·allocator·账户绑定·writer 不一致时禁止 INITIAL/EMPTY CAS；已有保留行时仍读到原命令与原身份 |
| 合法后映射或 fence 失效 | 完整映射且 fence 有效时留下保留行后，映射无效或 fence 失效须立即阻断新 EMPTY / 旧未知造 receipt；原保留行仍在 |
| 合法多城不误伤 | 完整映射且 fence 有效时额外 `player_city` 行仍可写入；旧 CreateCity 语义不变 |

## Out of scope

[#2588](FIRST_CITY_LEDGER_RETENTION_CUTOVER.md) / [#2586](FIRST_CITY_LEDGER_ABSENCE.md) / [#2584](FIRST_CITY_LEDGER_INITIAL.md) 已冻场景；生产旧 writer 在线排他、realm 认证、drain/fence 生产控制器、WS/浏览器/`fresh_admission.go`；生产 DDL / `player_city_id_seq` / WORLD realm 列。本卡不认证 realm、不 cutover/部署/生产 fence。

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_mapping_fence
```

Record `SHOW server_version` and each `PASS mapping_fence:` line.

## Follow-on

§11 browser、生产旧 writer 在线排他、drain/fence 控制器、realm 认证 — separate cards.
