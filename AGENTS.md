# AGENTS.md

多 agent 协作约定。任何接入本仓库的 agent 必须先读这份文件，再读自己的权威任务卡（`tasks/backlog.yml`；接手阶段限定手工卡见第二节）。

**复刻项目**：原版资料只读，用法与边界见 [`docs/reference.md`](docs/reference.md)。**禁止合并** PR #77、#82。实现时规则看 `server/`、流程看 `swf/`、数值看 `db/`、视觉看 `art/`；不要把原版代码、文案或美术复制进主树（`internal/`、`client/assets` 等）。

## 一、唯一真源

| 内容 | 位置 | 谁可以改 |
|---|---|---|
| 任务卡 | `tasks/backlog.yml`；第二节限定手工卡以其 GitHub issue 为真源 | 仅人工 / 编排者 |
| 接口契约 | `spec/proto/` `spec/db/` | 只能通过独立 PR 修改，需 review |
| 规则说明 | `spec/rules/` | 对应域 agent |
| 代码 | `internal/<domain>/` | 该域 agent，其他人只读 |

**跨域改动一律禁止。** 需要别的域配合时，提 issue 或在 PR 里说明，不要直接改别人的目录。

## 二、领任务

### 接手阶段限定手工注册（普通单域卡）

- 仅对用户已授权的本项目后续工程修复、已确认的原创美术及其独立接入，由编排者在 GitHub 手工建立自包含任务 issue；遵守 [接手约定](docs/SUCCESSOR-POLICY-2026-10-26.md) 的范围与保留限制。不新增 wave，不恢复旧 bot；此入口不授予全仓自动改动、范围外功能、部署或新的外部权限。
- 这类卡以其唯一 GitHub issue 为**权威注册**，无需再写入 backlog 或触发同步；这是第一节与 [任务说明](tasks/README.md) 中 backlog 真源规则的限定例外，优先于“所有卡必须来自 backlog”的泛称。backlog 已登记卡仍以 backlog 为真源，不能用手工副本覆盖；注册前核对 backlog 与现有 issue 的 ID、scope 和负责人，避免重复卡及并发写入冲突。
- issue 标题用 `[全局唯一任务 ID] 标题`；正文必须写明授权依据、目标、单一 domain / owner_dir、精确文件 scope / out_of_scope、改动 ≤400 行、输入契约与参照链接、依赖任务 / PR 及解除阻断条件、可验证验收、负责人和状态。无依赖须明确写无；字段不全不得开工。
- 领卡前确认依赖与同域并发写入者，记录唯一负责人；同文件或共享写入边界有冲突时先协调、阻断依赖卡。状态沿用第六节标签，并在 issue 保持负责人和状态一致；无 wave 的手工卡按 ID / domain 查询，不使用下方 wave:1 筛选来判断是否存在。
- issue 与 draft PR 双向链接，PR 关联 `Closes #...`；保留原始 source commit / tree、修正 commit、最终 PR head / 合并 commit 的映射和精确测试证据（无既有源时明确写新实现）。本地工作或源 commit 不等于已注册，不追认旧历史已履行领卡 / PR 流程。
- 一卡一 PR、单域、≤400 行及第四至七节要求不变；所有 `spec/` 变更（含 rules-only）先走独立 SPEC-only PR、独立 review，满足适用契约冻结 / 通知门槛后再推进依赖实现。每个最终组件及依赖组合均须审阅和验证，不发布已知有缺陷的中间态；共同启用的写入者须协调兼容性与回滚边界。
- 精确最终 head 须通过独立 review、全部必需 CI 与适用单测 / 集成 / 真实验收；基线或内容变更重核 review 并重跑受影响验证。合并后核验 main / push CI；源码合并不等于部署或生产验收，迁移、排空等部署门槛单独保留。历史 reference / art / VERIFY hold（含 #77 / #82 / #108）不合并，也不借新卡搬运规避。
- 此入口只调整注册组织方式，不修改 `tasks/backlog.yml`、同步工具 / 工作流、CODEOWNERS、分支保护、权限或安全门槛；不触发旧波次同步。第三节一次性接收栈及其累计 diff 例外不扩展至这些普通卡；遇到真实门槛阻断仍报告并解决，不以本节作豁免。

以下命令仅示例 backlog 的 wave:1 领卡；手工卡使用其准确 issue 编号，仍遵守认领和状态规则。

```bash
# 看有哪些可领的
gh issue list --label status:ready --label wave:1 --limit 50

# 领一张（自己 assign 自己，打 in-progress）
gh issue edit <number> --add-label status:in-progress --remove-label status:ready
gh issue edit <number> --add-assignee @me
```

一次只领一张。领了就要在 24 小时内出 PR，否则放回 `status:ready`。

## 三、分支与提交

```bash
git worktree add ../rxsg-<task-id> -b feat/<task-id>
```

- 分支名：`feat/SPEC-001`、`fix/MIL-012`
- 提交信息：`<task-id>: <一句话>`，正文写清改了什么、怎么验证
- 一个 PR 只做一张卡，改动 ≤ 400 行；普通及后续实现仍按此规则，不得用下述一次性接收路径代替日常领卡与 PR。

### 一次性接收已交付修复栈（ORCH-INTEGRATION-RELEASE-001）

- 仅接收基线 `fcc35527f9d0ea8e6fa2f1cfad868ab421819e62` 至稳定源 `867f686667c889cd679ea9b6bd5f07cfc9d4dc74` 的 189 个源 commit；后续至 `c05152164dc80b357ab86f0eec521269328c6087` 的 11 个源 commit 须完成自身必需验收后另批处理。除此以外的新研发不在此一次性范围内。
- 源 commit 不等同正式任务卡，也不宣称历史领卡/逐卡 PR 流程已经履行。接收时保留不可变逐 commit 清单（来源/parent/tree、域/scope、路径、行数），按最终修正后的**单域审阅组**逐组给出独立 review、修正来源与精确证据，再审阅完整依赖组合。
- 编排接收卡可在 GitHub issue 手工注册，必须自包含目标、输入契约、允许文件、验收、参照与负责人/状态，并说明为何不触发 backlog 的旧 wave 全量同步；不新增 wave，不改 `tasks/backlog.yml`、同步工作流或权限。普通任务注册规则不变。
- 仅该栈的 SPEC-only 与实现整合发布 PR 的累计 diff 豁免 400 行；这只改变接收/发布组织方式，不授权跨域开发或新增业务逻辑。普通正式卡仍单域且 ≤ 400 行；后发现的修复另立对应域正式卡、独立 review 和验证，并作为显式修正加入新的批准源 tree，不改写原冻结快照。
- 所有改变的 `spec/`（含 rules-only）必须先进入独立 SPEC-only 整合 PR，独立审阅并满足第四、五节的契约/通知/冻结门槛；实现整合 PR 不混入 spec 新差异。每个最终单域组件及全部依赖必须完成审阅，不能把已知有缺陷的中间 commit 当成可单独发布状态。
- 发布清单须固定基线、原始与修正后的最终源码 tree、单域审阅组映射、测试证据、排除项和已知限制；最终代码逐路径/模式/blob 与批准源一致。只有另行审阅并逐项列明的编排说明和公开发布证据可作为非代码例外。
- 未解决的阻断 finding、缺失依赖、仍待必需验收的组件和历史 reference/art hold（含 #77/#82/#108）不得进入整合包。有共同启用约束的组件必须完整整合，核对生产入口、写入者兼容性与回滚边界；运行时迁移/排空等仍是独立部署门槛。
- 全部 PR 从 draft 开始，精确最终 head 必须通过独立 review、所有必需 CI 和真实集成/验收门槛；CI 跳过的数据库/自然流程不算已验收。基线或内容变化须重核审阅有效性并重跑受影响验证。不更改 CODEOWNERS、分支保护、CI 权限、审批或任何安全门槛。
- 仅在既有自主合并授权内合并，并核验合并后 main tree 与 push CI；此一次性接收不代表部署、生产就绪、完整游戏验收或解除历史 hold。完成本冻结栈接收后不再用于新实现。

## 四、PR 要求

- 标题：`<task-id> <标题>`
- 正文必须包含：关联 issue（`Closes #12`）、做了什么、怎么验证、影响范围
- CI 必须绿
- 越界改动（改了非 `scope` 里的文件）CI 直接 fail
- 不满足以下任一条件不予合并：
  - [ ] 单测覆盖新增逻辑
  - [ ] 集成测试通过
  - [ ] 没有修改 `spec/`（除非本卡就是 spec 卡）
  - [ ] 文档更新

## 五、契约变更

改 `spec/proto/` 或 `spec/db/` 必须：

1. 单独开 PR，标题 `contract: <说明>`
2. 在 PR 里列出受影响的域和任务卡
3. 合并后由编排者通知相关 agent 更新

契约冻结期内（每周评审后到下次评审前）不接受变更。

## 六、进度怎么看

```bash
# 全局
gh issue list --state open --limit 200

# 按域
gh issue list --label domain:military --state all

# 当前迭代
gh issue list --label wave:1 --state open
```

看板口径：

| 标签 | 含义 |
|---|---|
| `status:ready` | 契约已就绪，可开工 |
| `status:blocked` | 等依赖 |
| `status:in-progress` | 已认领 |
| `status:review` | PR 待审 |
| `status:done` | 已合并，等关单 |

## 七、上下文自包含

每张任务卡必须能让 agent 在**不读其他代码**的情况下开工，卡里要有：目标、输入契约、允许改的文件、验收标准、参照物。

卡里缺信息，先提 issue 补卡，不要靠猜。
