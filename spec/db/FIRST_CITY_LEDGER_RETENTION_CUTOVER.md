# Retention / cutover fail-closed matrix (SPEC-FIRST-CITY-LEDGER-RETENTION-CUTOVER-001)

**Not** adopted, deployed, realm-enrolled, cutover-enabled, or production-enabled. Task
[#2587](https://github.com/anitaguptaoffice/sanguo-slg/issues/2587). Stacks
[#2586](https://github.com/anitaguptaoffice/sanguo-slg/pull/2586) /
[FIRST_CITY_LEDGER_ABSENCE.md](FIRST_CITY_LEDGER_ABSENCE.md).

Normative: [CITY_CREATION_RECOVERY.md](../rules/CITY_CREATION_RECOVERY.md) §5 items 7–8、§9 retention/cutover、
§11 **retention/cutover** 行；[FIRST_CITY_LEDGER.md](FIRST_CITY_LEDGER.md) §2 ID retention（不得 reuse/rotation/DELETE，终态保持终态）。
Disposable PG17 harness：独立观察者连接、真实事务、可读 `world_first_city_command` / slot head / harness 提案与保留行列。

## In scope (this card only)

| Obligation | Harness proof |
|------------|----------------|
| 成功后删城或改属 | 不得清除/回收 command·slot·receipt ID；不得接受 EMPTY INITIAL；观察者仍读到原命令与原身份 |
| retained rejection 不得 reset 成 EMPTY | 模拟 head 清空/TTL reset 后仍保留拒绝行；不得 EMPTY INITIAL |
| 账户改绑 fail closed | 原 slot/命令保留；旧/新绑定路径均不得 EMPTY INITIAL 或新 command ID |
| 不完整 restore / 缺 ledger / 模板遗失 / allocator highwater 回退 | 禁止 INITIAL/EMPTY CAS；不得自动补写；零城 legacy actor 不得借缺失获资格 |
| 合法多城不被首城 slot 误伤 | 同库额外 `player_city` 行仍可写入；旧 CreateCity 语义不变 |

## Out of scope (frozen elsewhere)

- [#2584](FIRST_CITY_LEDGER_INITIAL.md) INITIAL 十条；[#2586](FIRST_CITY_LEDGER_ABSENCE.md) absence 四场景
- [#2578](FIRST_CITY_LEDGER_UNKNOWN_DRAIN.md) drain、生产旧 writer 在线排他、realm 映射/fence、`cmd/server`/WebSocket/浏览器
- `internal/api/fresh_admission.go`、§10 第 5–7 项、目标 realm 认证、部署/启用、`player_city_id_seq` 激活

生产侧旧 writer 排他、映射持续失效立即阻断、目标 realm 认证 — 另卡；本卡不执行。

## Acceptance

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_retention_cutover
```

Record `SHOW server_version` and each `PASS retention:` line. Does **not** certify any target realm, production cutover, or complete §11 native product acceptance.

## Follow-on

§11 native browser、realm drain/fence 生产控制器 — separate SPEC cards.
