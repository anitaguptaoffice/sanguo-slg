# 多 Agent（Herdr / 独立 Agent）并行调度与防跑偏操作手册

本文供后续接手的协调器（如 `sg-coordinator`）或独立开发 Agent 使用，确保多 Agent 团队严格沿着 `R0 → R5` 推进，**绝不退回切微卡刷单或堆叠废代码的老路**。

---

## 一、接手前必做的现场切换步骤

1. **同步最新规划分支/主线**：
   - 各工作区统一 `git fetch origin` 并切到最新规划基线（合入本规划后的 `main` 或 `docs/PLAN-REMAKE-20261118`）。
   - 若使用独立 worktree，统一基于最新基线重建干净 worktree，**严禁**恢复 11 月 17 日归档清理前的旧 `cursor/*` 或 `feat/SPEC-FIRST-CITY-LEDGER-*` 废弃分支。
2. **清理 Herdr Supervisor 旧挂起状态（若启用本机 Herdr 团队）**：
   - 当前 `/home/allyin/.local/state/herdr-supervisor/sanguo-slg/state.json` 处于 `paused` 状态，且带有旧制度下的残留 `pending_events`。
   - 重启团队前，必须先给 `coordinator` 注入本规划路径（`AGENTS.md` + `docs/plan/README.md`），废弃旧 WIP 微卡上下文，从 **`Phase R0`** 重新排程。

---

## 二、阶段串并行铁律（先单线清创，再多线合围）

### 阶段 1：`Phase R0` 严禁多路业务并发
- **原因**：`R0-1` 改 CI、`R0-2` 删前端 `516` 个文件并改 `35` 个宿主、`R0-3` 改后端启动主干。若此时派其他 Agent 写新功能，必然产生大面积合并冲突。
- **排程方式**：
  1. 先单卡合并 **`R0-1`**（拆 CI 地雷、收敛 workflow）；
  2. 随后 **`R0-2`**（`client` Agent 清创前端 4.6 万行）与 **`R0-3`**（`backend` Agent 合一后端单轨运行时）可**双路并行**（文件域完全正交：`client/**` vs `internal/**`）；
  3. `R0-2` 与 `R0-3` 双双合入 `main` 并通过重启冒烟后，宣布地基就绪，正式解锁 `R1`。

### 阶段 2：`Phase R1 → R5` 标准三拍并行波次
每个大阶段内部遵循**「契约冻结半步 → 三轨并行实现 → 端到端可玩门禁收口」**：
1. **第 1 拍（契约与配置基座，1 张轻量卡）**：由后端主责 Agent 先落盘本阶段所需的 `spec/proto`、`spec/db` 迁移 SQL 与 `spec/data/source/*.yml` 生成物（例如 `R1-S1`），快速审阅合入 `main`。
2. **第 2 拍（前后端 + 美术三轨并行）**：
   - **`backend-a`（世界/军事/战斗线）**：负责大地图、行军、战术战斗引擎、侦察、名城与副本后端切片（如 `R1-S3`、`R1-S4`）；
   - **`backend-b`（内政/经济/将领/数据线）**：负责内外城建筑、人口税收、科技、附属野地加成、名将装备与联盟后端切片（如 `R1-S5`、`R2-S1..S4`）；
   - **`client`（场景与交互线）**：基于已冻结的 Proto 契约并行开发 `WorldMapScene`、内外城视图与操作面板（如 `R1-S2` 与各切片 UI）；
   - **`art`（原创美术资源线）**：按切片资源清单异步生产等距地形瓦片、建筑、兵种、装备 PNG 与 `manifest.json` 候选包（如 `R1-S6`），不阻塞工程用规范几何占位先行跑通逻辑。
3. **第 3 拍（独立 `review` + 真实浏览器 Playable Gate）**：
   - `review` Agent 对照下文「五条一票否决红线」审查代码与启动真实服务 + 浏览器验收脚本，通过后合并入 `main`。

---

## 三、Review 一票否决红线（防止再次跑偏）

`review` Agent 或协调器遇到以下任一情况，**无论单测或 CI 是否全绿，必须直接打回重做**：

1. **伪迭代堆叠红线**：新增了任何带 `Residual`、`Deep`、`Deeper`、`Deepest`、`Sweep`、`NarrowManifest` 命名的文件，或在 UI 上堆叠重复只读状态条、暴露 `v1` 协议名/调试探针。
2. **偏离原版机制红线**：涉及建筑、科技、兵种、野地、人口税收、战斗规则时，未对照 [`docs/plan/01-LEGACY-PARITY-SPEC.md`](01-LEGACY-PARITY-SPEC.md) 与 `origin/reference/legacy-source`，私自编造玩具公式或硬编码坐标假桩。
3. **分裂运行时红线**：新增仅限 `loopback` 运行的开关、外置本地快照文件锁，或破坏 `make dev` 开箱即用启动体验。
4. **切香肠空转红线**：提交了玩家完全无感知、纯内部空转的 dormant 状态机排列组合卡（非阶段首拍必需契约卡）。
5. **跳过真机可玩验收红线**：玩法切片仅跑了 mock 单测，未在真实 `cmd/server` + PostgreSQL 17 + Headless Browser 下验证完整玩家点击链路，或在测试中使用长 `sleep` 干等业务倒计时。
6. **版权污染红线**：从 `reference/legacy` 或 `art/reference-assets` 拷贝了任何原版 PHP 代码、原版长描述文案或原版图片文件。

---

## 四、交给后续协调器 / 执行 Agent 的一键启动 Prompt 模板

后续把项目交给新的主控 Agent 或恢复协调器时，直接发送以下指令即可无缝接力：

```text
接手仓库 https://github.com/anitaguptaoffice/sanguo-slg 的后续实现。
开工前请按顺序完整阅读：
1. AGENTS.md（2026-11-18 新版研发宪章，已废除旧波次规则与历史玩法禁令）
2. docs/plan/README.md（R0 -> R5 总路线图）
3. docs/plan/01-LEGACY-PARITY-SPEC.md（《热血三国》原版 1:1 规则与数值映射总纲）
4. docs/plan/02-R0-SURGICAL-CLEANUP-RUNBOOK.md 与 docs/plan/03-R1-WORLD-PVE-SLICES.md
5. docs/plan/05-MULTI-AGENT-WORKFLOW.md（并行分工与 Review 否决红线）

请严格按规划从当前未完成的首个切片开始推进（先完成 Phase R0 的 R0-1 -> R0-2 / R0-3 清创与单轨运行时合一，验收全绿后再进入 Phase R1 全屏世界大地图与野地/黄巾真实 PvE 闭环）。按垂直功能切片交付，不需要每张常规切片都停下来问我，只有遇到规划外的重大产品取舍或外部权限阻断时再向我确认。
```
