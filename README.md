# SLG 页游

面向社区运营的三国题材 SLG 网页游戏。全新代码库、全新美术、自研服务端，按分服模式设计。

- 服务端：Go 1.23 + PostgreSQL 17 + Redis 7 + NATS JetStream
- 客户端：Vite + TypeScript，Canvas 2D / DOM（H5），WebSocket + Protobuf（见 [docs/client-engine.md](docs/client-engine.md)）
- 部署：单机 docker-compose 起步，按服水平扩展

## 目标

| 指标 | 目标 |
|---|---|
| 单服 CCU | 3000 |
| 请求 P99 | < 80ms |
| 战斗结算 | 500 场/秒 |
| 定时器误差 | < 1s（万级队列） |
| 客户端首屏 | < 3s，地图 60fps |

## 里程碑（2026-11-18 1:1 复刻重规划）

> 现行权威规划与切片施工蓝图见 **[`docs/plan/README.md`](docs/plan/README.md)**，研发协作宪章见 **[`AGENTS.md`](AGENTS.md)**。

| 阶段 | 核心范围 | 出口标准 |
|---|---|---|
| **Phase R0** | 外科清创与单轨运行时合一 | 铲除前端 ~4.6 万行波次堆叠废代码，统一标准 PG 可部署运行时，收敛 CI |
| **Phase R1 (`M-Next`)** | 全屏世界大地图与野地/黄巾真实 PvE | 全屏 `WorldMapScene`、8 地形与黄巾守军、将领统兵入战、召回/加速、附属野地占领加成与采集 |
| **Phase R2** | 原版内外城、人口经济、科技与全兵种城防 | 内外城 20 建筑、人口/民心/税收/市场、书院 28 科技、12 常规兵种 + 5 城防 + 伤兵营 |
| **Phase R3** | 射程战术战斗引擎、装备工坊与历史名将 | 距离推进回合制与战术、铁匠铺/马厩装备坐骑强化、927 历史名将寻访/生擒/招降、新手引导链 |
| **Phase R4** | 爵位分城、斥候侦察烽火与同服 PvP 联盟战 | 爵位晋升筑分城、多城运输协防、侦察对抗与烽火预警、玩家掠夺/占城战与联盟外交 |
| **Phase R5** | 县/郡/州/洛阳名城国战与战役副本终局 | 34 历史名城国战与特殊兵种、沙场/战役副本、原创美术全覆盖与 3000 CCU 开服验收 |

## 目录

```
├── AGENTS.md          协作约定（agent 必读）
├── spec/              契约：proto、DDL、规则
├── internal/          服务端业务域
├── client/            H5 客户端
├── cmd/               可执行入口
├── tools/             开发与数据工具
└── tasks/             任务卡（同步到 GitHub Issues）
```

## 怎么参与

```bash
gh issue list --label status:ready --label wave:1
```

领卡 → 建 worktree → 提交 PR。完整流程见 `AGENTS.md`，任务卡规则见 `tasks/README.md`。

## 冒烟（M2 / M3）

本地库就绪后（`make dev-up`），可跑网关集成测：

```bash
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
# M2 战斗闭环
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM2BattleReportSmokePath -count=1 -v
# M3 选服、聊天、军团、排行
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM3SocialSmokePath -count=1 -v
```

说明与限制见 `tools/smoke/README.md`。

## 文档

| 文档 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 系统架构与域划分 |
| `docs/client-engine.md` | 客户端当前栈、分层与引擎备选 |
| `docs/ROADMAP.md` | 阶段计划 |
| `spec/rules/` | 玩法规则 |
| `spec/proto/` | 通信协议 |
| `spec/db/` | 数据模型 |
