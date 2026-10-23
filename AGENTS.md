# AGENTS.md

多 agent 协作约定。任何接入本仓库的 agent 必须先读这份文件，再读 `tasks/backlog.yml` 里自己那张卡。

## 一、唯一真源

| 内容 | 位置 | 谁可以改 |
|---|---|---|
| 任务卡 | `tasks/backlog.yml` | 仅人工 / 编排者 |
| 接口契约 | `spec/proto/` `spec/db/` | 只能通过独立 PR 修改，需 review |
| 规则说明 | `spec/rules/` | 对应域 agent |
| 代码 | `internal/<domain>/` | 该域 agent，其他人只读 |

**跨域改动一律禁止。** 需要别的域配合时，提 issue 或在 PR 里说明，不要直接改别人的目录。

## 二、领任务

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
- 一个 PR 只做一张卡，改动 ≤ 400 行

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
