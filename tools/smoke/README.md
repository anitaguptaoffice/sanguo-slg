# 冒烟脚本说明

依赖本地 PostgreSQL（与 `make dev` 相同栈）。未设置 `DATABASE_URL` 时集成测会自动 skip。

CI 默认 `go test ./...` 不带 `DATABASE_URL`，集成测跳过；带 `-short` 时跳过 INTG-005 长测（含进程重启模拟）。

## Wave7 对齐复跑（INTG-005，推荐）

DATA-001 核心子集 cfg + 商城真扣 `player_wallet` + 任务/背包/限购/禁言 PG 持久化，并在同一用例内模拟进程重启后复验 M3 选服/排行子集。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestINTG005Wave7SmokePath -count=1 -v
```

覆盖：

1. 灌入 `spec/data/generated/*.sql`（DATA-001 子集）
2. M4：任务 1001 → 领奖 → 商城 offer 1001 真扣费 → GM 发奖 → GM 禁言
3. 关闭网关、新建 `api.Server` 与 PG 连接池，登录后校验任务/背包/钱包/限购/禁言与重启前一致
4. M3 子集：选服列表 → 进服 → 战力榜刷新与查询（rank PG，非 RANK-002 深度验收）

步骤日志带 `smoke step:` 与 `server_id=1`。跳过短测：

```bash
GOTOOLCHAIN=go1.23.0 go test -short ./internal/api -count=1
```

## M2 战斗闭环（INTG-002）

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestM2BattleReportSmokePath|TestLoginCreateCityUpgradeFlow' -count=1 -v
```

覆盖：注册/登录 → 建城 → 募兵/行军 → 战报查询。

## M3 多人社交（INTG-003）

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM3SocialSmokePath -count=1 -v
```

覆盖：**选服列表** → **登录进服**（`server_id=1` 会话）→ **世界聊天一条** → **创建军团** → **军团频道** → **排行刷新** → **查询战力榜并校验上榜**。

失败时测试会打印 `step=` 与 `server_id=` 便于定位。

## M4 内容闭环（INTG-004）

任务 → 背包 → 商城 → GM 发奖。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM4ContentSmokePath -count=1 -v
```

步骤输出带 `smoke step:` 前缀与 `server_id=1`，失败时可对照日志定位。

覆盖路径：

1. 注册 / 登录（`server_id=1`）
2. `quest.v1.AcceptQuest`（教程任务 1001）→ `ReportQuestProgress` → `ClaimQuestReward`（道具 2001 入背包）
3. `shop.v1.ListShopShelf` → `PurchaseShopOffer`（offer 1001，扣银币/金币并发货）
4. `GmService.GrantReward` 补发道具 2003 并校验背包
5. `content.v1.ListPlayerBag` / `UseConsumable` 网关校验

任务 / 商城配置默认使用内置 dev catalog；若 `cfg_quest` 表已有数据则优先读库（与 DATA-001 生成物一致时可先跑 INTG-005 灌数）。

可选 HTTP GM（`make dev` 启动后）：

```bash
curl -sS -X POST http://127.0.0.1:8080/gm/grant \
  -H 'Content-Type: application/json' \
  -d '{"server_id":1,"player_id":<id>,"audit":{"operator_id":"dev","reason":"manual"},"rewards":{"items":[{"item_cfg_id":2003,"qty":1}]}}'
```

## 真实进程

```bash
make dev-up
GOTOOLCHAIN=go1.23.0 make dev
```

WebSocket 网关：`ws://127.0.0.1:8080/ws`（默认 `HTTP_ADDR`，见 `internal/platform/config`）。

### 已知限制

- 行军队列在进程内存（`march.Hub`）；**重启后未完成的行军/募兵队列不会恢复**，但 DOM-002 已持久化城池资源与建筑。
- 战斗目标驻点由 `combat.M2FixtureGarrisons()` 提供，当前为坐标 (5,5)。
- 排行榜定时刷新间隔默认 5 分钟；冒烟测通过 `RefreshRanks` 手动触发快照。
- 商城货架定义仍由装配层 dev catalog 提供；限购计数与 `player_wallet` 扣费已落 PG（wave7 / ECON-001）。
