# 冒烟脚本说明

依赖本地 PostgreSQL（与 `make dev` 相同栈）。未设置 `DATABASE_URL` 时集成测会自动 skip。

CI 默认 `go test ./...` 不带 `DATABASE_URL`，集成测跳过；带 `-short` 时跳过 INTG-008 / INTG-007 / INTG-006 / INTG-005 长测（含进程重启模拟）。

## Wave 11 网关冒烟（INTG-008，推荐）

在 INTG-007 路径上强制验收 **HERO-003** `ListRecruitTemplates`（非空、`template_cfg_id=1001` 含资源+道具消耗）、**QUEST-002** 日常链 `chain_id=400`：`daily_food_1`（`quest_cfg_id=1012`）经 **GM grant + collect_resource 挂钩** 推进后领奖；可选 `daily_recruit_1`（`quest_cfg_id=1015`）经 `RecruitHero` + `recruit_hero` 挂钩后领奖。保留邮件/商城/钱包/禁言/重启与 M3 子集断言。

**QUEST-003 可选**：`train` / `build` / `use` 其一的挂钩断言在 QUEST-003 合并前仅探测、**失败不阻塞主路径**（见测试内 `smokeQuest003Optional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG008Wave11SmokePath' -count=1 -v
```

与 INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` 与 `INTG-008:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## M4 加深冒烟（INTG-007）

在 INTG-006 路径上强制验收 **MAIL-001**（GM 发信 → 列表 → 领附件入背包）、**HERO-002**（`RecruitHero` + `ListPlayerHeroes`）、**QUEST-002** 日常链 `daily_food_1`（`quest_cfg_id=1012`，`chain_id=400`），并保留任务/商城/钱包/禁言/重启与 M3 子集断言。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG007M4DeepSmokePath' -count=1 -v
```

与 INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:` 与 `INTG-007:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## DATA-002 对齐复跑（INTG-006）

DATA-002 扩量后的 `spec/data/generated/*.sql` 核心子集 + 商城真扣 `player_wallet` + 任务/背包/限购/禁言 PG 持久化，并在同一用例内模拟进程重启后复验 M3 选服/排行子集。行数上限见 `spec/data/CORE_SUBSET.md`。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

仅跑完整重启冒烟（与 INTG-005 别名等价）：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG006Data002SmokePath|TestINTG005Wave7SmokePath' -count=1 -v
```

覆盖：

1. 灌入 `spec/data/generated/*.sql`（DATA-002 子集：`cfg_item` → `cfg_quest` → `cfg_shop*` → `cfg_hero_template` → `cfg_unit`）
2. M4：`quest_cfg_id=1001` → 领奖 `item_cfg_id=2001` → `offer_cfg_id=1001` 真扣费 → GM 发 `item_cfg_id=2003` → GM 禁言
3. 关闭网关、新建 `api.Server` 与 PG 连接池，登录后校验任务/背包/钱包/限购/禁言与重启前一致
4. M3 子集：选服列表 → 进服 → 战力榜刷新与查询（rank PG，非 RANK-002 深度验收）
5. 可选：`content.v1.ListPlayerMail`（MAIL-001 网关接线；失败不阻塞主路径）

失败时测试会打印 `DATA-002 cfg:` 行（固定 quest/offer/item id）便于对照 `spec/data/CORE_SUBSET.md`。

跳过短测（本地或 CI 快速编译路径）：

```bash
GOTOOLCHAIN=go1.23.0 go test -short ./internal/api -count=1
```

可选 GM 发信（MAIL-001，`cmd/gm`）：

```bash
GOTOOLCHAIN=go1.23.0 go run ./cmd/gm send-mail \
  --server-id=1 --player-id=<id> --title=smoke --body=test \
  --rewards-json='{"items":[{"item_cfg_id":2001,"qty":1}]}' \
  --operator-id=dev --reason=smoke
```

## Wave7 对齐复跑（INTG-005 别名）

与 **INTG-006** 相同路径；保留 `TestINTG005Wave7SmokePath` 供旧脚本兼容。新文档请以 INTG-006 为准。

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

任务 → 背包 → 商城 → GM 发奖（灌 DATA-002 子集 cfg，与 INTG-006 主路径前半一致，无进程重启）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run TestM4ContentSmokePath -count=1 -v
```

步骤输出带 `smoke step:` 前缀与 `server_id=1`，失败时可对照日志与 INTG-006 的 cfg id 提示。

覆盖路径：

1. 注册 / 登录（`server_id=1`）
2. `quest.v1.AcceptQuest`（教程任务 1001）→ `ReportQuestProgress` → `ClaimQuestReward`（道具 2001 入背包）
3. `shop.v1.ListShopShelf` → `PurchaseShopOffer`（offer 1001，扣银币/金币并发货）
4. `GmService.GrantReward` 补发道具 2003 并校验背包
5. `content.v1.ListPlayerBag` / `UseConsumable` 网关校验

任务配置优先读 PG `cfg_quest`（DATA-002 灌数后）；商城 offer 仍走装配层 dev catalog（与 `offer_cfg_id=1001` 对齐）。

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
