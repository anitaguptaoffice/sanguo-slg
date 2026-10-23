# SLG 页游

面向社区运营的三国题材 SLG 网页游戏。全新代码库、全新美术、自研服务端，按分服模式设计。

- 服务端：Go 1.23 + PostgreSQL 17 + Redis 7 + NATS JetStream
- 客户端：Cocos Creator（H5），WebSocket + Protobuf
- 部署：单机 docker-compose 起步，按服水平扩展

## 目标

| 指标 | 目标 |
|---|---|
| 单服 CCU | 3000 |
| 请求 P99 | < 80ms |
| 战斗结算 | 500 场/秒 |
| 定时器误差 | < 1s（万级队列） |
| 客户端首屏 | < 3s，地图 60fps |

## 里程碑

| 里程碑 | 内容 | 出口标准 |
|---|---|---|
| M0 | 规格与契约 | 领域模型、协议、规则文档冻结 |
| M1 | 骨架 | 登录、主城、建筑、资源闭环 |
| M2 | 战斗 | 募兵、行军、战斗、战报 |
| M3 | 多人 | 分服、军团、聊天、排行 |
| M4 | 内容 | 任务、道具、商城、运营后台 |

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

## M2 冒烟（战斗闭环）

本地库就绪后（`make dev-up`），可跑网关集成测验证募兵→行军→战报查询：

```bash
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM2BattleReportSmokePath -count=1 -v
```

说明与限制见 `tools/smoke/README.md`。

## 文档

| 文档 | 内容 |
|---|---|
| `docs/ARCHITECTURE.md` | 系统架构与域划分 |
| `docs/ROADMAP.md` | 阶段计划 |
| `spec/rules/` | 玩法规则 |
| `spec/proto/` | 通信协议 |
| `spec/db/` | 数据模型 |
