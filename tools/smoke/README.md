# 冒烟脚本说明

依赖本地 PostgreSQL（与 `make dev` 相同栈）。未设置 `DATABASE_URL` 时集成测会自动 skip。

CI 默认 `go test ./...` 不带 `DATABASE_URL`，集成测跳过；带 `-short` 时跳过 INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / INTG-005 长测（含进程重启模拟）。

## Wave 25 网关冒烟（INTG-022，推荐）

在 INTG-021 全量断言之上强制验收 **建造队列字段**：`domestic.v1.GetCityState` 打印各槽位 `slot_key` 与 `upgrade_finish_at_ms`（`0` 表示空闲，供 CLIENT-105/107 对照）；**邮件未读**：`content.v1.ListPlayerMail` 打印 `total_count` 与 **未读**条数（`MAIL_INBOX_FILTER_UNREAD` 的 `total_count` 与 ALL 页推导一致，供 CLIENT-106 对照）；**日常待办**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印 `claimable_count` 与 `progress_complete_count`（`progress_current>=progress_target` 等价，供 CLIENT-107/091 对照）；**格点信息卡**：`world.v1.ListPlayerCities` 打印首条 `x`/`y`/`name`（供 CLIENT-108 对照）。保留 INTG-021 双榜 `my_rank`、军团 `role`、可选 `RecruitHero`、INTG-020 商城/邮件附件/建筑 level、INTG-019 资源/phase 及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG022Wave25SmokePath' -count=1 -v
```

与 INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-022:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 24 网关冒烟（INTG-021，推荐）

在 INTG-020 全量断言之上强制验收 **双榜自我定位**：`rank.v1.GetLeaderboard` 战力榜与资源榜各一次，打印 `my_rank` 与 `my_score`（供 CLIENT-096 排行自我定位对照；dev 空榜时 `my_rank=0` 仅打 hint）；**军团职务**：`guild.v1.ListGuildMembers` 打印首条 `role`（`GuildMemberRole` 枚举名，供 CLIENT-101 对照；玩家未入军团则 **skip** 并打印 hint）；**可选招募**：`hero.v1.RecruitHero` 在 dev 种子与钱包足够时打印 `hero_id`/`template_cfg_id`（供 CLIENT-098 对照；**失败不阻塞主路径**）。保留 INTG-020 商城 offer 价格、邮件未领附件、建筑 level 与 INTG-019 资源/phase/军团成员计数、INTG-018 将领/战报/日常/格点及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG021Wave24SmokePath' -count=1 -v
```

与 INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-021:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 23 网关冒烟（INTG-020，推荐）

在 INTG-019 全量断言之上强制验收 **商城 offer 资源价**：`shop.v1.ListShopShelf`（与 ListShopOffers 等价 offers 列表）首条打印 `price_resources` 粮/木/铁/石（供 CLIENT-092 购买缺口对照）；**邮件未领附件**：GM 发带附件信后 `content.v1.ListPlayerMail` 打印 `total_count` 与 `unclaimed_attachment_count`（由 `attachments` + `claimed_at_ms`/`status` 等价推导，供 CLIENT-087/091 对照）；**建筑等级**：`domestic.v1.GetCityState` 首条 `buildings` 打印 `slot_key` 与 `level`（供 CLIENT-082/088 消耗预览对照）。保留 INTG-019 城池 resources/production_rates、ListMarches phase、军团成员与 INTG-018 将领/战报 rounds/日常/格点及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG020Wave23SmokePath' -count=1 -v
```

与 INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-020:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 22 网关冒烟（INTG-019，推荐）

在 INTG-018 全量断言之上强制验收 **城池资源余量**：`domestic.v1.GetCityState` 打印 `wallet`（粮/木/铁/石余量，日志前缀 `resources`）与 `production_rates` **同一行**（供 CLIENT-081/082 HUD 扫读对照）；**行军阶段**：`StartMarch` 后 `military.v1.ListMarches` 首条打印 `phase`（枚举名或 `phase_num`）与 `march_id`（供 CLIENT-080/085 军情阶段提醒）；**军团成员**：`guild.v1.ListGuildMembers` 打印 `members` 条数（玩家未入军团则 **skip** 并打印 hint「join guild」——可选 `CreateGuild` 在 INTG-010 社交路径中已尝试）。保留 INTG-018 将领养成/战报 rounds/日常进度/城池格点与进程重启持久化等路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG019Wave22SmokePath' -count=1 -v
```

与 INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-019:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 21 网关冒烟（INTG-018，推荐）

在 INTG-017 全量断言之上强制验收 **将领养成字段**：`hero.v1.GetHeroDetail` 打印 `level`、`loyalty` 与四维 `force`/`intel`/`politics`/`command`（供 CLIENT-072 养成对比）；**战报回合**：`GetBattleReport` 打印 `detail.rounds` 条数与首条 `round` 序号（dev 无战报则 **skip** 并打印 hint）；**日常进度**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印首条 `progress_current`/`progress_target`；**城池列表格点**：`world.v1.ListPlayerCities` 打印 `cities` 条数与首条 `x`/`y`（供 CLIENT-073 信息卡对照）。保留 INTG-017 战报时间/outcome、`production_rates`、ListMarches 格点与进程重启持久化等路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG018Wave21SmokePath' -count=1 -v
```

与 INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-018:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 20 网关冒烟（INTG-017，推荐）

在 INTG-016 全量断言之上强制验收 **战报时间/胜负**：`military.v1.ListBattleReports` `limit≥1` 时首条 summary 含 `created_at_ms` 与 `outcome`（日志打印两字段；dev 无战报则 **skip** 并打印 hint）；**城池产出速率**：`domestic.v1.GetCityState` 打印 `production_rates` 粮/木/铁/石 `+/h`（全 `0` 时注明 dev 空城或无产出建筑）；**军情目的格点**：`StartMarch` 后 `ListMarches` 首条 `to_x`/`to_y` 与冒烟请求一致（打印 `march_id` 与格点，供 CLIENT-069 筛选对照）。保留 INTG-015 行军 ETA、战报分页、INTG-014 坐标/rounds 与进程重启持久化等 INTG-016 路径。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG017Wave20SmokePath' -count=1 -v
```

与 INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-017:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 19 网关冒烟（INTG-016，推荐）

在 INTG-015 全量断言之上强制验收 **将领详情**：`hero.v1.ListPlayerHeroes` 非空后取首 `hero_id` → `GetHeroDetail` 成功（日志打印 `template_cfg_id` 与四维 `force`/`intel`/`politics`/`command`）；**邮件分页**：`content.v1.ListPlayerMail` `page_size=5` `page_offset=0` 成功（打印 `total_count` 与条数），`page_offset=首页条数` 第二次调用不报错；**城池队列字段**：`domestic.v1.GetCityState` 打印 `buildings` 条数与首条 `upgrade_finish_at_ms`（`0` 表示空闲）。保留行军 ETA、战报分页、坐标/rounds、ClaimPlayerMailAttachments、邮件已读、建造加速与日常 claim、双榜/UseConsumable 2001/社交可选与进程重启持久化。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG016Wave19SmokePath' -count=1 -v
```

与 INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-016:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 18 网关冒烟（INTG-015，推荐）

在 INTG-014 全量断言之上强制验收 **行军 ETA**：`StartMarch` 响应 `march` 含 `depart_at_ms`/`arrive_at_ms` 且 `arrive_at_ms > depart_at_ms`（日志打印 `march_id` 与两时间戳）；`ListMarches` 首条目的点坐标与 INTG-014 一致。**战报分页**：`ListBattleReports` `limit=5` `offset=0` 成功（打印条数）；`offset=首页条数` 第二次调用返回空或更短列表且不报错（dev 无战报时与 INTG-012 一致 **skip** 并打印 hint）。保留 GetBattleReport 坐标/rounds、ClaimPlayerMailAttachments、邮件已读、建造加速与日常 claim、双榜/UseConsumable 2001/社交可选与进程重启持久化。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG015Wave18SmokePath' -count=1 -v
```

与 INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-015:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 17 网关冒烟（INTG-014，推荐）

在 INTG-013 全量断言之上强制验收 **行军目的点**：`StartMarch` 后 `military.v1.ListMarches` 首条含合法 `to_x`/`to_y`（日志打印 `march_id` 与坐标）；**战报坐标**：`ListBattleReports` 首条 `report_id` → `GetBattleReport` → `report.summary.location_x`/`location_y` 可解析为地图格（并打印 `defender_player_id`/`defender_city_id`），dev 无战报时与 INTG-012/013 一致 **skip** 并打印 hint。保留 GetBattleReport `detail.rounds`、ClaimPlayerMailAttachments、邮件已读、建造加速与日常 claim、双榜/UseConsumable 2001/社交可选与进程重启持久化。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**可选**：`RecruitTroop` 后 `ListMarches` 仍为空或仅含本次 `StartMarch` 的 `march_id`；**失败不阻塞主路径**（见测试内 `smokeINTG014RecruitTroopListMarchesOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG014Wave17SmokePath' -count=1 -v
```

与 INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-014:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 16 网关冒烟（INTG-013，推荐）

在 INTG-012 全量断言之上强制验收 **战报详情**：`ListBattleReports` 首条 `report_id` → `military.v1.GetBattleReport` → `report.detail.rounds` 非空（dev 无战报时与 INTG-012 一致跳过并打印 hint）；**MAIL-001 领取**：GM / dev 发带附件信 → 网关 `content.v1.ClaimPlayerMailAttachments`（日志打印 `mail_id` 与 `granted` 道具摘要）。保留 INTG-012 邮件已读、ListBattleReports 结构校验、INTG-011 建造加速与日常 claim、INTG-010 双榜/UseConsumable 2001/社交可选与进程重启持久化。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG013Wave16SmokePath' -count=1 -v
```

与 INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-013:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 15 网关冒烟（INTG-012，推荐）

在 INTG-011 全量断言之上强制验收 **MAIL-001 已读**：GM / dev 种子发信 → 网关 `content.v1.ListPlayerMail` → `MarkPlayerMailRead` → **未读筛选**下该 `mail_id` 不可见（日志打印 `mail_id` 与 `read_at_ms`）；**军事只读** `StartMarch` + `ListMarches` 后 `military.v1.ListBattleReports` `limit≥1` 时校验 `report_id` / `created_at_ms` / `outcome` 结构，dev 无战报（行军未抵达等）时断言空列表并打印 hint（与 INTG-010 dev 空榜策略一致）。保留建造加速 2003、daily train/build claim、双榜/UseConsumable 2001/社交可选等 INTG-011 路径。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG012Wave15SmokePath' -count=1 -v
```

与 INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-012:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 14 网关冒烟（INTG-011，推荐）

在 INTG-010 全量断言之上强制验收 **DOM-003** 建造加速：`StartBuildingUpgrade` 后有进行中队列 → 网关 `content.v1.UseConsumable` `item_cfg_id=2003` → `GetCityState` 对应槽位 `upgrade_finish_at_ms` **严格减小**（日志打印 `slot_key` 与 `delta_ms`）；**QUEST-003** 日常加深：`daily_train_1`（`quest_cfg_id=1014`）经 `RecruitTroop` + `train_troops` 挂钩推进后领奖，或 `daily_build_1`（`quest_cfg_id=1032`）经建造完成挂钩后领奖（失败打印 `quest_cfg_id`）。保留双榜/UseConsumable 2001/行军/邮件/商城/重启与 M3 子集等 INTG-010 路径。

**本波仍不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**QUEST-003 可选**：`UseConsumable` 远征干粮 `item_cfg_id=2020` 推进 `daily_march_1`（`quest_cfg_id=1033`）后领奖；**失败不阻塞主路径**（见测试内 `smokeINTG011DailyMarchOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG011Wave14SmokePath' -count=1 -v
```

与 INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-011:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 13 网关冒烟（INTG-010，推荐）

在 INTG-009 路径上强制验收 **双榜** `rank.v1.GetLeaderboard`：战力榜与资源榜各一次（`RefreshRanks` 后 `my_rank` 与条目 `entity_id` 非空；dev 空榜时测试仅打日志、见下文说明）；**经济** `content.v1.UseConsumable` 对 DATA-002 消耗品 `item_cfg_id=2001`（成功则扣背包并校验 `effect_summary`，预期失败时打印 `item_cfg_id` 不阻塞）。保留行军/邮件/日常/商城/重启与 M3 子集等 INTG-009 全量断言。

**本波不做** `CancelMarch`/行军加速——`military.v1` 契约未定义对应 RPC。

**社交可选**：`chat.v1` 世界频道发收一条 + `guild.v1` 创建军团；**失败不阻塞主路径**（见测试内 `smokeINTG010SocialOptional`）。

dev 空榜：本地未刷新排行或单服无种子玩家时，`GetLeaderboard` 可能 `total_count=0`；冒烟会记录 `viewer_player_id` 并继续，对照 `spec/data/CORE_SUBSET.md` 与 `make dev-up` 后重跑。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG010Wave13SmokePath' -count=1 -v
```

与 INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:`、`INTG-008:`、`INTG-009:` 与 `INTG-010:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 12 网关冒烟（INTG-009，推荐）

在 INTG-008 路径上强制验收 **军事网关** `StartMarch`（合法坐标与兵力）→ `ListMarches` 含对应 `march_id`（失败打印 purpose/phase）；**MAIL-001** `ListPlayerMail` 在 GM send-mail 后非空（与 INTG-007 一致，本波为主路径断言）。保留招募模板、日常 collect/recruit、商城、重启与 M3 子集断言。

**QUEST-003 可选**：`daily_train_1`（`quest_cfg_id=1014`）经 `RecruitTroop` + `train_troops` 挂钩推进后领奖，或 `daily_build_1`（`quest_cfg_id=1032`）经建造挂钩后领奖；**失败不阻塞主路径**（见测试内 `smokeQuest003TrainOrBuildOptional`）。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG009Wave12SmokePath' -count=1 -v
```

与 INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:`、`INTG-008:` 与 `INTG-009:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

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
