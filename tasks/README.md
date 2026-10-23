# 任务卡

`backlog.yml` 是任务清单的唯一真源。改完执行：

```bash
python3 tools/tasks_sync.py            # 同步到 GitHub Issues
python3 tools/tasks_sync.py --dry-run  # 先看会改什么
```

同步是幂等的：按 `[ID]` 前缀匹配，已存在的只更新内容与标签，不会重复创建。

## 字段

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 是 | `域-序号`，如 `MIL-001`，全局唯一 |
| `title` | 是 | 一句话，动宾结构 |
| `wave` | 是 | 1/2/3，第几波开工 |
| `domain` | 是 | 归属域，决定标签与目录所有权 |
| `depends_on` | 是 | 依赖的任务 ID，空数组表示可立即开工 |
| `size` | 是 | S（半天）/ M（1 天）/ L（2 天以上，建议再拆） |
| `owner_dir` | 是 | 允许修改的目录，CI 据此做越界检查 |
| `scope` | 否 | 允许修改的文件 glob |
| `out_of_scope` | 否 | 明确禁止修改的路径 |
| `acceptance` | 是 | 验收标准，必须可自动或人工验证 |
| `body` | 是 | 背景与实现要点，要能让 agent 独立开工 |

## 状态流转

```
status:blocked  ──依赖完成──▶  status:ready
status:ready    ──认领────▶  status:in-progress
status:in-progress ──提 PR──▶  status:review
status:review   ──合并────▶  status:done
```

状态靠标签维护，不改 YAML。YAML 只描述"任务是什么"，GitHub 描述"做到哪了"。

## 写卡的三条硬要求

1. **能独立开工**：不读其他代码也能动手。
2. **边界可判定**：scope 之外的改动必须能被 CI 拦住。
3. **验收可验证**：不写"实现良好"这种话。

## 当前波次

| 波次 | 内容 | 任务 |
|---|---|---|
| 1 | 规格 + 骨架 + 最高风险原型 | SPEC-001~004, PLAT-001~003, MIL-001, CLIENT-001 |
| 2 | 各业务域并行 | ACC-001, WORLD-001, DOM-001, MIL-002 |
| 3 | 内容与运营 | 待排 |
