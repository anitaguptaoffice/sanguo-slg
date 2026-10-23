# 开服运营最小流程（OPS-OPEN-001）

面向 **dev / staging** 环境的手动开服与值班检查。依赖已合并的 **PLAT-004**（选服列表、`server_id` 会话）、**GM-001**（`cmd/gm` 与 HTTP `/gm/*`）、**GM-002**（禁言写入 PG，聊天路径校验）。

## 范围与非目标

| 在范围内 | 非目标（本仓库 v1 不做） |
|---|---|
| 确认依赖健康、选服数据、玩家能进服 | 完整运营后台 UI |
| GM 查号 / 发奖 / 禁言（CLI 或 HTTP） | 活动配置台、可视化排期 |
| 可重复的 markdown 检查清单 | 支付、跨服、赛季运营 |

## 环境约定

| 项 | 本地 dev（`make dev`） | staging（示意） |
|---|---|---|
| Postgres | `docker compose` → `postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable` | 运维提供的 `DATABASE_URL` |
| Redis | `localhost:6379`（`REDIS_ADDR` 默认） | 运维提供的 `REDIS_ADDR` |
| 游戏 HTTP | `HTTP_ADDR` 默认 `:8080` | 同变量，指向 staging 负载地址 |
| WebSocket 网关 | `ws://127.0.0.1:8080/ws` | `wss://<staging-host>/ws` |
| GM 鉴权 | 可选 `GM_TOKEN`、`GM_OPERATOR_WHITELIST`（见 `internal/api/gm_auth.go`） | **必须**设置 `GM_TOKEN` 与白名单 |

启动栈（与仓库一致）：

```bash
make dev-up          # 仅 Postgres + Redis
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 make dev   # 应用 DDL、种子服、监听 :8080
```

`make dev` 启动时 `PrepareGame` 会：

1. 执行 `spec/db` 迁移；
2. 调用 `SeedDevServer` 确保 `game_server.server_id = 1`、展示名 **Dev-1**、`status = 1`（可玩）；
3. 初始化 `server_id = 1` 地图。

客户端选服 UI：`client/src/scenes/ServerSelectScene.ts`（`account.v1.ListGameServers` → `EnterGameServer`）。

---

## 1. 选服列表来源（PLAT-004）

**真源**：PostgreSQL 表 `game_server`（字段扩展见 `spec/db/m3_001_server_list.sql`）。网关路由 `account.v1.ListGameServers` 读取 `list_visible = true` 的行（实现：`internal/platform/shard/store.go`）。

| 环境 | 列表如何产生 |
|---|---|
| **dev** | 进程启动自动 `SeedDevServer(1, "Dev-1")`；无需手插即可在选服页看到 1 服 |
| **staging** | 运维在 PG 插入/更新 `game_server` 行（`display_name`、`status`、`opened_at`、`list_visible`、`sort_weight` 等）；**不**依赖客户端硬编码 |

**服状态（选服展示）**：`status = 0` 维护、`3` 停服时客户端会禁用进服（见 `ServerSelectScene`）；种子服为 `1`（正常）。

**自动化对照**（无需起 `make dev` 全进程）：

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM3SocialSmokePath -count=1 -v
```

冒烟第一步即 `ListGameServers`，失败时日志含 `step=list_game_servers`。

**手查 PG（staging 排障）**：

```bash
psql "$DATABASE_URL" -c \
  "SELECT server_id, display_name, status, list_visible, opened_at FROM game_server ORDER BY server_id;"
```

---

## 2. 进服流程

与 INTG-003 / 客户端一致：

1. WebSocket 连接 `/ws`；
2. （可选）未登录时也可拉选服列表；登录后列表会带 `has_player`；
3. `account.v1.Register` / `account.v1.Login`（`LoginRequest.server_id` 为目标服）；
4. `account.v1.EnterGameServer`（`server_id` + 会话 `session_id`）→ 会话绑定 `server_id`，后续玩法包带服上下文。

**H5 客户端**：`cd client && npm run dev`，进入 **选择游戏服** 场景（默认账号 `demo` / `demo123`，见 `ServerSelectScene.ts`）。

**仅验证网关**（集成测已覆盖）：见上文 `TestM3SocialSmokePath`。

---

## 3. 健康检查（可执行清单）

在宣布「服已开」前逐项勾选（命令可在 dev 复制粘贴；staging 替换主机与密钥）。

### 基础设施

- [ ] **Postgres**：`docker compose ps` 中 `postgres` 为 healthy，或  
  `pg_isready -U sanguo -d sanguo -h localhost`
- [ ] **Redis**：`redis-cli -h localhost ping` 返回 `PONG`

### 游戏进程与网关

- [ ] **进程已监听**：`make dev` 日志含 `server listening`，`addr` 为 `:8080`（或你的 `HTTP_ADDR`）
- [ ] **HTTP 健康**：`curl -sf http://127.0.0.1:8080/healthz` → `{"status":"ok"}`
- [ ] **WebSocket 可达**：跑通 `TestM3SocialSmokePath` 或客户端选服页「刷新列表」无报错
- [ ] **GM 子进程接线**（可选）：  
  `DATABASE_URL=... REDIS_ADDR=... go run ./cmd/gm` → 输出 `gm ready` 与 `lookup|grant|kick|mute` 提示

### Metrics（PLAT-003，按部署启用）

默认 `make dev` **仅**暴露 `/healthz` 与 `/ws`、`/gm/*`（见 `internal/platform/runtime/gateway.go`）。Prometheus 抓取需按 [deploy/README.md](../deploy/README.md) 挂载 `obs.Wrap` 并暴露 `/metrics`。

- [ ] **已接 observability 栈时**：`docker compose -f deploy/docker-compose.obs.yml up -d` 后  
  `curl -sf http://127.0.0.1:8080/metrics | grep -q sanguo_`  
  （若未挂载 `obs.Wrap`，本项标为 N/A，不以 metrics 作为 dev 开服硬门槛）

---

## 4. GM 运营检查清单（GM-001 / GM-002）

前置：至少一名玩家已在目标 `server_id` 创角（客户端进服或 `TestM3SocialSmokePath` / `TestM4ContentSmokePath`）。

环境变量（staging 建议全开）：

```bash
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
export REDIS_ADDR=localhost:6379
# 可选：export GM_TOKEN='your-secret'
# 可选：export GM_OPERATOR_WHITELIST='ops-alice,ops-bob'
```

构建 CLI：`make build-gm` → `./bin/gm`。

### 4.1 查号（lookup）

- [ ] 按 **登录名** 查询（`server_id=1`）：

```bash
./bin/gm lookup \
  --server-id=1 \
  --login='<玩家登录名>' \
  --operator-id=ops-check \
  --operator-name='开服检查' \
  --reason='OPS-OPEN-001 lookup' \
  --ticket-id=OPS-118
```

- [ ] 或按 **player_id** 查询：将 `--login` 换为 `--player-id=<id>`
- [ ] 输出 JSON 中 `player.server_id`、`player.player_id`、`player.chat_muted_until_ms` 合理；若玩家在线则 `player.online` 为 true（仅游戏进程内 GM 带会话注册表时）

HTTP（`make dev` 运行中，与 `tools/smoke/README.md` 同栈）：

```bash
curl -sS -X POST http://127.0.0.1:8080/gm/lookup \
  -H 'Content-Type: application/json' \
  -d '{
    "server_id": 1,
    "account_login": "<玩家登录名>",
    "audit": {"OperatorID": "ops-check", "Reason": "OPS-OPEN-001 lookup"}
  }'
```

若配置了 `GM_TOKEN`：加 `-H "Authorization: Bearer $GM_TOKEN"` 或 JSON `"token":"..."`。

### 4.2 发奖（grant）

- [ ] 使用 **幂等键** 发资源（与 `cmd/gm` / `GmService.GrantReward` 一致）：

```bash
./bin/gm grant \
  --server-id=1 \
  --player-id=<player_id> \
  --idempotency-key='ops-open-001-grant-1' \
  --food=1000 \
  --operator-id=ops-check \
  --reason='OPS-OPEN-001 grant smoke' \
  --ticket-id=OPS-118
```

- [ ] 再次执行同一 `--idempotency-key` 应成功且 `grant.duplicate` 为 true（见 `TestGmLookupAndGrant`）
- [ ] 道具发奖示例：`--rewards-json='{"items":[{"item_cfg_id":2003,"qty":1}]}'`（schema 同 `content.RewardPackage`）

HTTP 示例（来自 INTG-004 冒烟说明）：

```bash
curl -sS -X POST http://127.0.0.1:8080/gm/grant \
  -H 'Content-Type: application/json' \
  -d '{
    "server_id": 1,
    "player_id": <player_id>,
    "idempotency_key": "ops-open-001-http-grant",
    "audit": {"OperatorID": "ops-check", "Reason": "OPS-OPEN-001 grant"},
    "rewards": {"items": [{"item_cfg_id": 2003, "qty": 1}]}
  }'
```

端到端：`GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM4ContentSmokePath -count=1 -v`（含 GM 发奖步骤）。

### 4.3 禁言（mute，GM-002）

- [ ] 设置禁言截止时间（Unix **毫秒**）：

```bash
MUTE_UNTIL=$(($(date +%s) * 1000 + 3600000))
./bin/gm mute \
  --server-id=1 \
  --player-id=<player_id> \
  --mute-until-ms="$MUTE_UNTIL" \
  --operator-id=ops-check \
  --reason='OPS-OPEN-001 mute test' \
  --ticket-id=OPS-118
```

- [ ] `lookup` 再次查询，`chat_muted_until_ms` 与设定一致
- [ ] 该玩家发世界聊天应被拒绝（逻辑见 `TestGmMutePersistsAndBlocksChat`）
- [ ] 解禁：`--mute-until-ms=0`

HTTP：

```bash
curl -sS -X POST http://127.0.0.1:8080/gm/mute \
  -H 'Content-Type: application/json' \
  -d '{
    "server_id": 1,
    "player_id": <player_id>,
    "mute_until_ms": '"$MUTE_UNTIL"',
    "audit": {"OperatorID": "ops-check", "Reason": "OPS-OPEN-001 mute"}
  }'
```

### 4.4 参考命令（非开服必测）

`kick` 会踢网关会话并吊销 DB session（`gm kick --server-id=1 --player-id=...`）。开服最小清单 **不强制** 踢人，值班按工单使用。

---

## 5. 开服当日建议顺序

```mermaid
flowchart TD
  A[make dev-up / 确认 PG+Redis] --> B[部署或 make dev]
  B --> C[/healthz + 选服列表/]
  C --> D[客户端或 M3 冒烟进服]
  D --> E[GM lookup → grant → mute 勾选]
  E --> F[对外公告 / 监控 N/A 或 metrics]
```

---

## 6. 相关文档与任务

| 引用 | 说明 |
|---|---|
| [tools/smoke/README.md](../../tools/smoke/README.md) | M3/M4 冒烟命令 |
| [deploy/README.md](../deploy/README.md) | Prometheus / Grafana |
| `tasks/backlog.yml` | PLAT-004、GM-001、GM-002 验收条目 |
| `cmd/gm/main.go` | CLI 子命令与 `--help` |
| `spec/proto/sanguo/gm/v1/` | GM 协议契约 |
