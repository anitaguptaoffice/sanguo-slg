# AGENTS.md — 1:1 复刻与垂直切片研发宪章

> **2026-11-18 重规划生效**：本文为仓库唯一最高协作宪章，全面取代 `docs/HANDOVER-2026-10-26.md`、`docs/SUCCESSOR-POLICY-2026-10-26.md`、`docs/HANDOVER-PLATFORM-2026-11-12.md` 及 `spec/data/CORE_SUBSET.md` 中的历史波次规则、行数切香肠约束与玩法范围禁令。任何接入本仓库的协调器或执行 Agent 开工前必须先读本文与 [`docs/plan/README.md`](docs/plan/README.md)。

---

## 一、项目目标与版权红线

1. **北极星目标**：对标只读参照分支 `origin/reference/legacy-source`（`reference/legacy/`）与 `origin/art/reference-assets`，实现《热血三国》网页 SLG **全量核心系统 1:1 深度复刻**——世界州郡与野地/黄巾、内外城 20 种建筑、人口/民心/税收经济、书院 28 项科技、全兵种与 5 类城防、射程推进回合制战术战斗、历史名将寻访/生擒/招降、铁匠铺/马厩装备坐骑养成、爵位分城、侦察烽火、联盟战争及县/郡/州/洛阳名城国战与战役副本。
2. **只读参照与原创重制红线（不可逾越）**：
   - 规则查 `reference/legacy/server/game/*.php`，流程查 `reference/legacy/swf/`，数值结构查 `reference/legacy/db/schema.sql` 与 `bloodwar.sql.gz`，视觉密度对标 `reference/art/`（用法见 [`docs/reference.md`](docs/reference.md)）。
   - **代码、数据库表结构、游戏内文案、美术资源 100% 重新实现**。严禁将原版 PHP 源码、原版配置描述文本或原版图片文件复制进主树（`internal/`、`spec/data/`、`client/`）。
   - **永久禁止合并**历史参照与 Hold 分支：PR [#77](https://github.com/anitaguptaoffice/sanguo-slg/pull/77)、[#82](https://github.com/anitaguptaoffice/sanguo-slg/pull/82)、[#108](https://github.com/anitaguptaoffice/sanguo-slg/pull/108) 以及所有标题带 `[NEVER MERGE]` / `[HOLD]` 的历史分支。

---

## 二、全面废止的旧规则（严禁继续沿用）

以下历史惯性与限制自 2026-11-18 起**正式废止**：

1. **废止历史玩法禁令**：解禁 `CancelMarch`（行军召回）、行军/建造/募兵/科技加速、内外城建筑与科技新 RPC、战报协议扩量、装备养成、多城筑城、名城与副本配置扩量；废止 `DATA-002` / `CORE_SUBSET.md` 的人为行数封顶。
2. **废止机械单域禁令与 400 行切卡**：不再要求把一个玩家功能拆成几十张单目录 ≤400 行的碎片卡；不再搞 `wave:20–59` 式的伪迭代（“巩固再加深 N 层”）。
3. **废止过度形式化容灾仪式**：不再新增 PostgreSQL catalog OID 钉死（`freshsource` OID pin）、`COMMIT` 物理断连状态机穷举证明、或浏览器外部 Python 恢复许可脚本（`recruit_recovery_guard.py` 类仪式）。服务端一致性统一采用**标准 PostgreSQL ACID 事务 + `SELECT ... FOR UPDATE` 行锁 + 业务请求幂等键**。
4. **废止旧波次同步工具**：严禁运行 `tools/tasks_sync.py` 或触发 `.github/workflows/tasks-sync.yml` 重放历史 `tasks/backlog.yml`。

---

## 三、现行交付模式：垂直功能切片（Vertical Slice）

所有研发按 [`docs/plan/README.md`](docs/plan/README.md) 拆解的阶段（`R0 → R5`）与切片卡（如 `R0-1`、`R1-S1`）推进：

1. **切片定义**：一张切片卡代表一个**玩家在浏览器中可端到端体验并验收的完整子系统或清理目标**（见 `docs/plan/02-*.md` ～ `04-*.md`）。
2. **契约与实现组织**：
   - 小中型切片允许在同一 PR 内配套更新 `spec/`（`proto` / `db` / `data`）→ 生成物 → `internal/` → `client/`，一次性打通端到端闭环。
   - 若多 Agent 并行开发同一阶段（如后端与客户端同时做 `R1`），先提一张轻量的 `contract: <Slice-ID> ...` PR 冻结 `spec/proto` 与 `spec/db`，合并后前后端与美术并行合围。
3. **PR 粒度与可读性**：
   - 新增业务实现 PR 建议控制在 **≤ 1,500 行净有效代码**（不含 protoc 生成物、seed 数据与测试夹具）；`R0` 历史包袱清创删除行数不设上限。
   - 每个切片对应唯一 GitHub Issue（标题 `[<Slice-ID>] <标题>`）与唯一 PR（正文关联 `Closes #<issue>`）。

---

## 四、四大架构与质量红线（Review 必审）

### 1. 单一标准可部署运行时
- `cmd/server` 只能维护**唯一一套标准运行时路径**（`make dev` 与远程容器部署同构，基于常规 `DATABASE_URL` 与 `REDIS_ADDR`）。
- **严禁**新增仅限 `127.0.0.1` / `loopback` 运行的分叉模式、外部本地 profile 文件锁或双套并存的 v1/v2 重复业务 Hub。

### 2. 前端零堆叠与正式产品级 UI
- **严禁**新建任何 `*Residual*`、`*Deep*`、`*Deeper*`、`*Deepest*`、`*Sweep*`、`*NarrowManifest*` 补丁文件。迭代已有界面时直接修改目标 Scene / Panel 组件本身。
- **严禁**在玩家可见 UI 中渲染协议包名（如 `military.v1`）、DPR 探针（如 `art 1x @1.0dpr`）、裸内部 ID 或重复堆叠的状态摘要行。

### 3. 配置真源驱动（禁止业务硬编码假桩）
- 建筑、科技、兵种、城防、世界地形、野地/黄巾守军、掉落、名将、装备、任务数值一律沉淀在 `spec/data/source/*.yml` 并经生成脚本产出确定性 seed（`spec/data/generated/`）。
- **严禁**在 Go 或 TypeScript 代码中硬编码坐标桩（如 `(5,5)` 内存驻军）或脱离原版量纲的临时指数公式。

### 4. 可控时钟测试与真实可玩门禁
- **时间推进测试**：涉及建造、科技、募兵、行军、历练、野地刷新的单测与集成测试，必须注入可控时钟或在隔离测试事务中定向推进目标记录时间戳；**严禁**为业务时长 `sleep` 干等。
- **三层门禁**：
  1. `make test-fast`（单元与类型检查，无库秒级反馈）；
  2. `make test-gate`（受影响域的 PostgreSQL 真实事务测试 + `client` 构建与单测）；
  3. **切片可玩验收（Playable Gate）**：所有玩法切片合并前，必须在真实 Go Server + PostgreSQL 17 + Headless Browser 下跑通该切片定义的玩家操作链路并留存可复现脚本/报告。

---

## 五、接手导航与唯一目录真源

| 内容 | 权威路径 |
|---|---|
| 重规划总览与阶段入口 | [`docs/plan/README.md`](docs/plan/README.md) |
| 《热血三国》原版 1:1 规则与数值映射字典 | [`docs/plan/01-LEGACY-PARITY-SPEC.md`](docs/plan/01-LEGACY-PARITY-SPEC.md) |
| Phase R0 外科清创与单轨合一施工手册 | [`docs/plan/02-R0-SURGICAL-CLEANUP-RUNBOOK.md`](docs/plan/02-R0-SURGICAL-CLEANUP-RUNBOOK.md) |
| Phase R1（M-Next）全屏大地图与野地/黄巾 PvE 切片卡 | [`docs/plan/03-R1-WORLD-PVE-SLICES.md`](docs/plan/03-R1-WORLD-PVE-SLICES.md) |
| Phase R2–R5 全量系统切片蓝图 | [`docs/plan/04-R2-R5-SYSTEM-BLUEPRINT.md`](docs/plan/04-R2-R5-SYSTEM-BLUEPRINT.md) |
| 多 Agent（Herdr）并行调度与验收手册 | [`docs/plan/05-MULTI-AGENT-WORKFLOW.md`](docs/plan/05-MULTI-AGENT-WORKFLOW.md) |
| 顶层里程碑看板 | [`docs/ROADMAP.md`](docs/ROADMAP.md) |
| 原版只读参照说明 | [`docs/reference.md`](docs/reference.md) |
| 通信协议与数据库 Schema | `spec/proto/`、`spec/db/`、`spec/data/` |
