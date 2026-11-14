# Signed rollback artifact apply exclusion (SPEC-FIRST-CITY-LEDGER-SIGNED-ROLLBACK-EXCLUSION-001)

**Not** deployed, realm, cutover, drain/fence controller, browser/WS, production signed rollback deployment, or `player_city_id_seq`. [#2609](https://github.com/anitaguptaoffice/sanguo-slg/issues/2609); does not re-run [#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md) in-process `legacy_worker` / `rollback_prior` scenes or [#2608](FIRST_CITY_LEDGER_BACKGROUND_WRITER_EXCLUSION.md) bg-writer scenes.

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5.6 / §6 **第 11 行**。

## Baseline artifact inventory (registration tree negative evidence)

**Negative evidence:** no production signed CITY rollback binary under `cmd/`; `tools/data/validate_recruit_manifest.py` is recruit-only; [#2594](FIRST_CITY_LEDGER_OLD_BINARY_EXCLUSION.md) `rollback_prior` has no in-tree production signed artifact.

Harness 子进程 **`signed_rollback_apply_worker`** 从 `harness_test_rollback_manifest.json` 加载 **明确标注非生产签名** 的测试制品并执行制品级 apply SQL bundle；**不是**生产签名 rollback 制品，**不是** drain/fence 控制器，**不是** `CreateCityInTx` in-process 模式（#2594）。

| 场景（harness） | 证明要点 |
|------|----------|
| `signed_rollback_no_visible_first_city` | 排他下制品级 apply 不得提交可见首城；保留 command / `player_city` / allocator highwater |
| `no_empty_reopen_or_command_id_reuse` | 不得 EMPTY 重开；不得复用 `command_id` |
| `missing_or_unverified_artifact_not_drained` | 生产签名制品缺席；仅停 #2592–#2608 已覆盖入口 + 持 ledger 行锁不足以宣称第 11 行制品路径已排空 |
| `signed_rollback_no_false_drain` | 制品级 writer 仍活跃时 profile/drain bump 不得解锁 EMPTY intake |
| `lawful_multi_city_not_blocked` | 合法非首都分城 apply 仍可提交 |

**另卡：** realm、drain/fence、§11 browser、目标 realm 对真实签名制品现场核验、`player_city_id_seq`。
OID §6 第 12 行新 ledger intake/effect/finalizer 未授权-直至-义务门槛：[NEW-INTAKE-AUTHORIZATION-001](FIRST_CITY_LEDGER_NEW_INTAKE_AUTHORIZATION.md)（#2611；`first_city_ledger_new_intake_authorization`）。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_signed_rollback_exclusion
```

记录 `SHOW server_version`、制品清单/缺席行与各 `PASS signed_rollback_exclusion:` 行。
