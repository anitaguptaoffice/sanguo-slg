# New ledger intake/effect/finalizer unauthorized-until-obligations (SPEC-FIRST-CITY-LEDGER-NEW-INTAKE-AUTHORIZATION-001)

**Not** realm certification, cutover, deployment, drain/fence **production** controller, production new intake/effect/finalizer,
`player_city_id_seq`, browser/WS, or playable-first-city product acceptance. [#2611](https://github.com/anitaguptaoffice/sanguo-slg/issues/2611);
stacks on [#2610](https://github.com/anitaguptaoffice/sanguo-slg/pull/2610) / OID §5 / §6 **第 12 行**；不重跑 #2592–#2610 旧 writer / 维护 / 制品级 rollback 五条场景。

Normative: CITY_CREATION_RECOVERY §9 / §11；[OID_PROFILE](FIRST_CITY_LEDGER_OID_PROFILE.md) §5 / §6 第 12 行（`world_first_city_*` + effect relations；义务未满足前 **unauthorized / fail-closed**）。

## Baseline production new-route inventory (registration tree negative evidence)

Tree search at #2610 head (`cmd/`, `tools/`, `internal/`, release paths): **no** production writer, enable switch, or admission controller
for OID §6 row 12 post–follow-on **new** ledger intake / effect / finalizer route. `internal/` has no `world_first_city_*` references;
`cmd/` has no first-city ledger server entry. Isolated harness packages under `spec/db/tests/` (race, effect_path, slot_cas, …) exercise
**disposable** contracts only — **not** authorized production paths.

Harness 子进程 **`new_ledger_route_worker`** 走 intake → effect（capital 首城）代表事务链；**不是**已授权生产新路径，**不是** drain/fence 控制器，**不是** `signed_rollback_apply_worker`（#2610）或 #2594 `legacy_worker`，**不**启用 `player_city_id_seq`。

| 场景（harness） | 证明要点 |
|----------------|----------|
| `incomplete_profile_or_inventory_keeps_closed` | profile 缺字段或 §6 第 1–11 行 inventory 缺 drain/negative evidence 时，新路径不得提交可见首城效果 |
| `substitute_fence_not_authorization` | 表/行锁、profile 字段存在、进程内 drain counter **不**替代 §5 through-commit；不足以授权第 12 行 |
| `partial_drain_not_partial_enablement` | 只排空部分 inventory 行不得部分启用新路径 |
| `unauthorized_intake_no_empty_reopen_or_id_reuse` | 未授权尝试不得 EMPTY 重开、不得复用 `command_id`、不得降 allocator highwater |
| `lawful_multi_city_not_blocked` | 完整义务满足时合法非首都分城不得被 fail-closed 误伤 |

**另卡（本卡不执行）：** 目标 realm 认证、生产 drain/fence 控制器、§11 browser、生产签名 rollback、`player_city_id_seq`、生产新路径启用。

```bash
./spec/db/validate.sh
export FIRST_CITY_LEDGER_TEST_DSN='postgres://…' ALLOW_OWNED_PG17_TEST=1
GOTOOLCHAIN=local go run ./spec/db/tests/first_city_ledger_new_intake_authorization
```

记录 `SHOW server_version`、生产新路径清单/缺席行与各 `PASS new_intake_authorization:` 行。
