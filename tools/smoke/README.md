# 冒烟脚本说明

依赖本地 PostgreSQL（与 `make dev` 相同栈）。未设置 `DATABASE_URL` 时集成测会自动 skip。

CI 默认 `go test ./...` 不带 `DATABASE_URL`，集成测跳过；带 `-short` 时跳过 INTG-058 / INTG-057 / INTG-056 / INTG-055 / INTG-054 / INTG-053 / INTG-052 / INTG-051 / INTG-050 / INTG-049 / INTG-048 / INTG-047 / INTG-046 / INTG-045 / INTG-044 / INTG-043 / INTG-042 / INTG-041 / INTG-040 / INTG-039 / INTG-038 / INTG-037 / INTG-036 / INTG-035 / INTG-034 / INTG-033 / INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / INTG-005 长测（含进程重启模拟）。

## Wave 58 网关冒烟（INTG-058，推荐）

在 INTG-057 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深五层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest-deepest-deepest-deeper** 巩固 hint，CLIENT-372/373）、**将领养成扫读残余巩固再加深五层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest-deepest-deepest-deeper** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-374/375）、**双榜钉选刷新残余巩固再加深五层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest-deepest-deepest-deeper** hint，CLIENT-376；**非** wave:57 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深五层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest-deepest-deepest-deeper** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest-deepest-deepest-deeper** hint，CLIENT-377）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深五层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest-deepest-deepest-deeper** 对照，CLIENT-378）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG058Wave58SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-058:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 57 网关冒烟（INTG-057，推荐）

在 INTG-056 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深五层**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deepest-deepest-deepest-deeper** 锚点 hint + 军情 phase 再出征预填 **residual deepest-deepest-deepest-deeper**，CLIENT-364/370）、**出征兵力余量与刷新戳记残余巩固再加深五层**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deepest-deepest-deepest-deeper** hint，CLIENT-365）、**战报键盘相邻导航与坐标复制残余巩固再加深五层**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 j/k **deepest-deepest-deepest-deeper** hint，CLIENT-366）、**邮件 HUD 附件残余巩固再加深五层**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **deepest-deepest-deepest-deeper** hint，CLIENT-367）、**背包商城返回高亮残余巩固再加深五层**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deepest-deepest-deepest-deeper** hint，CLIENT-368）、**排行密度与招募扫读残余巩固再加深五层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deepest-deepest-deepest-deeper** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-369；**非** wave:56 双榜钉选主叙事）、**日常可领 HUD 残余巩固再加深五层**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deepest-deepest-deepest-deeper** hint，CLIENT-367 HUD）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG057Wave57SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-057:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 56 网关冒烟（INTG-056，推荐）

在 INTG-055 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深五层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest-deepest-deepest-deeper** hint，CLIENT-356/357）、**将领养成扫读残余巩固再加深五层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest-deepest-deepest-deeper** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-358/359）、**双榜钉选刷新残余巩固再加深五层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest-deepest-deepest-deeper** hint，CLIENT-360；**非** wave:55 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深五层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest-deepest-deepest-deeper** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest-deepest-deepest-deeper** hint，CLIENT-361）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深五层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest-deepest-deepest-deeper** 对照，CLIENT-362）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG056Wave56SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-056:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 55 网关冒烟（INTG-055，推荐）

在 INTG-054 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深四层**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deepest-deepest-deepest** 锚点 hint + 军情 phase 再出征预填 **residual deepest-deepest-deepest**，CLIENT-348/354）、**出征兵力余量与刷新戳记残余巩固再加深四层**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deepest-deepest-deepest** hint，CLIENT-349）、**战报键盘相邻导航与坐标复制残余巩固再加深四层**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 j/k **deepest-deepest-deepest** hint，CLIENT-350）、**邮件 HUD 附件残余巩固再加深四层**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **deepest-deepest-deepest** hint，CLIENT-351）、**背包商城返回高亮残余巩固再加深四层**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deepest-deepest-deepest** hint，CLIENT-352）、**排行密度与招募扫读残余巩固再加深四层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deepest-deepest-deepest** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-353；**非** wave:54 双榜钉选主叙事）、**日常可领 HUD 残余巩固再加深四层**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deepest-deepest-deepest** hint，CLIENT-351 HUD）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG055Wave55SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-055:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 54 网关冒烟（INTG-054，推荐）

在 INTG-053 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深四层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest-deepest-deepest** hint，CLIENT-340/341）、**将领养成扫读残余巩固再加深四层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest-deepest-deepest** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-342/343）、**双榜钉选刷新残余巩固再加深四层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest-deepest-deepest** hint，CLIENT-344；**非** wave:53 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深四层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest-deepest-deepest** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest-deepest-deepest** hint，CLIENT-345）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深四层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest-deepest-deepest** 对照，CLIENT-346）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG054Wave54SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-054:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 53 网关冒烟（INTG-053，推荐）

在 INTG-052 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深三层**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deepest-deepest-deeper** 锚点 hint + 军情 phase 再出征预填 **residual deepest-deepest-deeper**，CLIENT-332/338）、**出征兵力余量与刷新戳记残余巩固再加深三层**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deepest-deepest-deeper** hint，CLIENT-333）、**战报键盘相邻导航与坐标复制残余巩固再加深三层**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 **deepest-deepest-deeper** hint，CLIENT-334）、**邮件 HUD 附件残余巩固再加深三层**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **deepest-deepest-deeper** hint，CLIENT-335）、**背包商城返回高亮残余巩固再加深三层**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deepest-deepest-deeper** hint，CLIENT-336）、**排行密度与招募扫读残余巩固再加深三层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deepest-deepest-deeper** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-337；**非** wave:52 双榜钉选主叙事）、**日常可领 HUD 残余巩固再加深三层**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deepest-deepest-deeper** hint，CLIENT-335 HUD）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG053Wave53SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-053:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 52 网关冒烟（INTG-052，推荐）

在 INTG-051 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深三层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest-deepest-deeper** hint，CLIENT-324/325）、**将领养成扫读残余巩固再加深三层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest-deepest-deeper** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-326/327）、**双榜钉选刷新残余巩固再加深三层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest-deepest-deeper** hint，CLIENT-328；**非** wave:51 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深三层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest-deepest-deeper** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest-deepest-deeper** hint，CLIENT-329）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深三层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest-deepest-deeper** 对照，CLIENT-330）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG052Wave52SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-052:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 51 网关冒烟（INTG-051，推荐）

在 INTG-050 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深二层**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deepest-deeper** 锚点 hint + 军情 phase 再出征预填 **residual deepest-deeper**，CLIENT-316/322）、**出征兵力余量与刷新戳记残余巩固再加深二层**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deepest-deeper** hint，CLIENT-317）、**战报键盘相邻导航与坐标复制残余巩固再加深二层**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 **deepest-deeper** hint，CLIENT-318）、**邮件 HUD 附件残余巩固再加深二层**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **deepest-deeper** hint，CLIENT-319）、**背包商城返回高亮残余巩固再加深二层**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deepest-deeper** hint，CLIENT-320）、**排行密度与招募扫读残余巩固再加深二层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deepest-deeper** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-321；**非** wave:50 双榜钉选主叙事）、**日常可领 HUD 残余巩固再加深二层**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deepest-deeper** hint，CLIENT-319 HUD）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG051Wave51SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-051:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 50 网关冒烟（INTG-050，推荐）

在 INTG-049 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深二层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest-deeper** hint，CLIENT-308/309）、**将领养成扫读残余巩固再加深二层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest-deeper** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-310/311）、**双榜钉选刷新残余巩固再加深二层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest-deeper** hint，CLIENT-312；**非** wave:49 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深二层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest-deeper** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest-deeper** hint，CLIENT-313）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深二层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest-deeper** 对照，CLIENT-314）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG050Wave50SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-050:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 49 网关冒烟（INTG-049，推荐）

在 INTG-048 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深一层**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deepest** 锚点 hint，CLIENT-300/306）、**出征兵力余量与刷新戳记残余巩固再加深一层**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deepest** hint，CLIENT-301）、**战报键盘相邻导航与坐标复制残余巩固再加深一层**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 **deepest** hint，CLIENT-302）、**邮件 HUD 附件残余巩固再加深一层**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **deepest** hint，CLIENT-303）、**背包商城返回高亮残余巩固再加深一层**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deepest** hint，CLIENT-304）、**排行密度与招募扫读残余巩固再加深一层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deepest** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-305；**非** wave:48 双榜钉选主叙事）、**日常可领 HUD 残余巩固再加深一层**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deepest** hint，CLIENT-303 HUD）、**军情 phase 再出征预填残余巩固再加深一层**（`ListMarches` 多行 `phase` + `prefill_to_x`/`to_y` **residual deepest** hint，CLIENT-306）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG049Wave49SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-049:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 48 网关冒烟（INTG-048，推荐）

在 INTG-047 全量断言之上扩展 **主城七槽队列 ETA/完成焦点残余巩固再加深一层**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA 分段/完成态 **residual deepest** hint，CLIENT-292/293）、**将领养成扫读残余巩固再加深一层**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/`GetHeroDetail` `exp` **residual deepest** hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-294/295）、**双榜钉选刷新残余巩固再加深一层**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + `my_rank`/`snapshot_refreshed_at_ms` 钉选刷新 **residual deepest** hint，CLIENT-296；**非** wave:47 排行密度/招募扫读主叙事）、**军团职务与聊天扫读再加深一层**（`guild.v1.ListGuildMembers` 职务/战力 **residual deepest** hint + `chat.v1.ListChatMessages` 军团频道首条 id/长度未读分隔 **residual deepest** hint，CLIENT-297）、**日常 chain 与队列 ETA 互链及 HUD 待办底栏深链再加深一层**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **residual deepest** 对照，CLIENT-298）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG048Wave48SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-048:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## 功勋/经验/体力出征 L9–L11 网关冒烟（INTG-046，推荐）

在 INTG-045 全量断言之上覆盖 **L9 功勋点**（`GetHeroDetail` 暴露属性/`exp`/`march_force`；`AddHeroPoint` 分配 + 非空闲拒绝）、**L10 历练**（`BeginHeroExpr` → 提前 `FinishHeroExpr` 拒绝 → 时钟推进 → `FinishHeroExpr` 经验入账 + `GetHeroDetail` `exp`）、**L11 出征体力**（体力不足 `StartMarch` → **50005**；空闲 `RestHero` 回满；出征扣体力；非空闲 `RestHero` 拒绝）。无城 **skip** + hint；**不改**业务语义，仅测试/种子。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG046HeroL9L11SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-046:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 47 网关冒烟（INTG-047，推荐）

在 INTG-043 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固再加深**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deeper** 锚点 hint，CLIENT-284/290）、**出征兵力余量与刷新戳记残余巩固再加深**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deeper** hint，CLIENT-285）、**战报键盘相邻导航与坐标复制残余巩固再加深**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 **residual deeper** hint，CLIENT-286）、**邮件 HUD 附件残余巩固再加深**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **residual deeper** hint，CLIENT-287）、**背包商城返回高亮残余巩固再加深**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deeper** hint，CLIENT-288）、**排行密度与招募扫读残余巩固再加深**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deeper** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-289；**非**钉选专用 RPC）、**日常可领 HUD 残余巩固再加深**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deeper** hint，CLIENT-287 HUD）、**军情 phase 再出征预填残余巩固再加深**（`ListMarches` 多行 `phase` + `prefill_to_x`/`to_y` **residual deeper** hint，CLIENT-290/291）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG047Wave47SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-047:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## 俘虏/结交/来投 L6–L8 网关冒烟（INTG-045，推荐）

在 INTG-044 全量断言之上覆盖 **L6 俘虏**（`InjectCaptive` 种子 → `hero.v1.ListCaptiveHeroes`；`TrySummonCaptive` 城不匹配拒绝 + 成功预检；GM 补金 → `SureSummonCaptive` 招降 + 非俘虏再招降拒绝；第二俘虏 `ReleaseCaptive` 释放）、**L7 来投**（`InjectComing` → `ListComingHeroes`；`RejectComing` + 已拒 `TryAcceptComing` 非状态拒绝；`TryAcceptComing` / `SureAcceptComing` 接受）、**L8 结交**（`ListPersuadeTargets`；未结交 `PersuadeHero` 拒绝；`LionizeHero` 结交 + 好友不足再招募拒绝；GM 锦囊 + 测试时钟推进冷却 → 两次 `PersuadeHero` → `LionizeHero` 招募）。无城 **skip** + hint；**不改**业务语义，仅测试/种子。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG045HeroL6L8SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-045:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## 将领 L1–L5 网关冒烟（INTG-044，推荐）

在 INTG-043 全量断言之上覆盖 **L1 客栈**（`hero.v1.ListHotelRecruitCandidates` 打印 candidates 长度 + `hotel_level`/`hero_capacity`/`hero_owned`；无客栈建筑 **skip** + hint；可选 `RefreshHotelRecruitPool` / `RecruitHotelCandidate` 成功或容量/缺金错误 hint）、**L2 出征绑将**（`military.v1.StartMarch` 必填 `hero_id`、非空闲拒绝、出征 status 与 Hub 结束后恢复 idle；沿用 `smokeEnsureMarchHeroID`）、**L3 赏赐**（`hero.v1.LargessHero` 忠诚 delta + 冷却拒绝 hint；钱包不足 **skip** + hint）、**L4 升级**（`hero.v1.UpgradeHero` 经验足够 level+1 / 不足拒绝；`GetHeroDetail` 暴露 `exp`/`exp_toward_next`/`upgrade_exp_required`，M1≤20）、**L5 城主**（`SetCityChief` / `GetCityChief` / `ClearCityChief` 一城一职；出征中拒绝任职；卸任恢复 idle）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**；**无**俘虏/结交。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG044HeroL1L5SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-044:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 46 网关冒烟（INTG-043，推荐）

在 INTG-042 全量断言之上扩展主城七槽 `GetCityState` 队列 ETA/完成 **residual deeper**（CLIENT-276/277）、将领 `ListPlayerHeroes`+背包养成扫读（CLIENT-278/279）、双榜钉选刷新（CLIENT-280）、军团成员+聊天（CLIENT-281）、日常 `ListPlayerQuests` 与队列 ETA 互链 HUD 深链（CLIENT-282）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。仍不做募兵加速/主城建造新 RPC/战报 proto 扩量/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG043Wave46SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-043:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 45 网关冒烟（INTG-042，推荐）

在 INTG-041 全量断言之上扩展 **小地图军情 scroll-sync 残余巩固加深**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync **residual deep** 锚点 hint，CLIENT-268/274）、**出征兵力余量与刷新戳记残余加深**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms` **residual deep** hint，CLIENT-269）、**战报键盘相邻导航与坐标复制残余巩固加深**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 相邻条 **residual deep** hint，CLIENT-270）、**邮件 HUD 附件残余加深**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id` + HUD **residual deep** hint，CLIENT-271）、**背包商城返回高亮残余加深**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度 **residual deep** hint，CLIENT-272）、**排行密度与招募扫读残余加深**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 **residual deep** hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-273；**非**钉选专用 RPC）、**日常可领 HUD 残余加深**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数 **residual deep** hint，CLIENT-271 HUD）、**军情 phase 再出征预填残余加深**（`ListMarches` 多行 `phase` + `prefill_to_x`/`to_y` **residual deep** hint，CLIENT-274/275）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG042Wave45SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-042:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 44 网关冒烟（INTG-041，推荐）

在 INTG-040 全量断言之上扩展 **主城七槽队列 ETA/完成焦点巩固**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + ETA/完成态 **consolidated** hint，CLIENT-260/261）、**将领养成扫读巩固**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚/经验 **consolidated** hint + `content.v1.ListPlayerBag` 首条养成 `item_id`/`count`，CLIENT-262/263）、**双榜钉选刷新巩固**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + 钉选/刷新 **consolidated** hint，CLIENT-264）、**军团职务与聊天扫读巩固**（`guild.v1.ListGuildMembers` 职务/在线 **consolidated** hint + `guild.v1.ListGuildChatMessages` 首条 id/列表长度，CLIENT-265）、**日常 chain 与队列 ETA 互链加深**（`quest.v1.ListPlayerQuests` 可领条数 + chain 类型 hint + 与 `GetCityState` 队列 ETA **cross consolidated** 对照，CLIENT-266 HUD/日常深链）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG041Wave44SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-041:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 43 网关冒烟（INTG-040，推荐）

在 INTG-039 全量断言之上扩展 **小地图军情 scroll-sync 残余**（`military.v1.ListMarches` 首条 `phase`/`to_x`/`to_y` + 视口 scroll-sync 锚点 hint，CLIENT-252/258）、**出征兵力余量与刷新戳记**（`military.v1.StartMarch` ≡ `MarchAttack` 同源，`march_id` + `city_troops` 余量 + `intel_list_refresh_stamp_ms`，CLIENT-253）、**战报键盘相邻导航与坐标复制**（`military.v1.ListBattleReports` 首条 `outcome`/坐标 + 列表长度 + 相邻条 hint，CLIENT-254）、**邮件 HUD 附件**（`content.v1.ListPlayerMail` 未领附件计数 + 首条 `mail_id`，CLIENT-255）、**背包商城返回高亮**（`content.v1.ListPlayerBag` 消耗品分类首条 + `shop.v1.ListShopShelf` 列表长度，CLIENT-256）、**排行密度与招募扫读**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首行 `score` 密度 hint + `hero.v1.ListRecruitTemplates` 长度，CLIENT-257；**非**钉选专用 RPC）、**日常可领 HUD**（`quest.v1.ListPlayerQuests` `chain_id=400` 可领条数，CLIENT-255 HUD）、**军情 phase 再出征预填**（`ListMarches` 多行 `phase` + `prefill_to_x`/`to_y` hint，CLIENT-258）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG040Wave43SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-040:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 42 网关冒烟（INTG-039，推荐）

在 INTG-038 全量断言之上扩展 **主城七槽双队列 ETA/完成焦点残余**（`domestic.v1.GetCityState` 七槽 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms` + 完成态分段 hint，CLIENT-244/245）、**将领养成扫读**（`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + 忠诚字段 hint + `content.v1.ListPlayerBag` 养成 `item_id`/`count`，CLIENT-246/247）、**双榜钉选刷新残余**（`rank.v1.GetLeaderboard` ≡ `ListPowerRank`/`ListKillRank` 列表长度 + 首条 `player_id` + 钉选刷新 hint，CLIENT-248）、**军团职务与聊天扫读**（`guild.v1.ListGuildMembers` 职务/在线 hint + `guild.v1.ListGuildChatMessages` 首条 id/列表长度，CLIENT-249）、**日常 chain 与队列 ETA 互链**（`quest.v1.ListPlayerQuests` 可领条数 + `GetQuestChainStatus` chain 类型 hint + 与 `GetCityState` 队列 ETA 对照，CLIENT-250 HUD/日常深链）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量；**不跑 H5**。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG039Wave42SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-039:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 41 网关冒烟（INTG-038，推荐）

在 INTG-037 全量断言之上扩展 **视口军情 scroll-sync**（`ListMarches` 多行 + `ListPlayerCities` 视口锚点，CLIENT-236/237）、**出征刷新戳记**（`StartMarch`/`MarchAttack` 同源，`march_id`+stamp，CLIENT-238）、**战报密度键盘**（`ListBattleReports` outcome/坐标，CLIENT-239/240）、**邮件/日常 HUD**（`ListPlayerMail` 未领附件+首条 id、`ListPlayerQuests` 可领条数，CLIENT-241）、**背包排行招募扫读**（`ListPlayerBag` 消耗品分类、`ListPowerRank`/`ListKillRank`、`ListRecruitTemplates` 长度、`ListShopShelf` 首 SKU，CLIENT-242）。空数据 **skip** + hint；**不**测 `CancelMarch`；**无** proto/SKU 扩量。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG038Wave41SmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-038:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 40 网关冒烟（INTG-037，推荐）

在 INTG-036 全量断言之上强制验收 **主城七槽队列抛光**：`domestic.v1.GetCityState` 打印七槽各 `building_cfg_id` + `build_queue`/`recruit_queue` 首条 `upgrade_finish_at_ms`（供 CLIENT-228/229 对照；无城 **skip** + hint）；**将领面板壳**：`hero.v1.ListPlayerHeroes` 打印首条 `hero_id`/`level` hint（供 CLIENT-230/231 对照；空 **skip** + hint）；**背包使用**：`content.v1.ListPlayerBag` 首条消耗品 `item_id`/`count` + 既有 `UseConsumable` 路径打印结果 hint（供 CLIENT-232 对照；空 **skip** + hint；**不**扩 SKU）；**日常领取 UX**：`quest.v1.ListPlayerQuests` `chain_id=400` 可领取条数 + 首条 `quest_id` hint（供 CLIENT-233 对照；无可领 **skip** + hint）；**军团社交扫读**：`guild.v1.ListGuildMembers` 职务/在线字段 hint + `guild.v1.ListGuildChatMessages`（`chat.v1.ListChatMessages` 军团频道）列表长度（供 CLIENT-234 对照；无军团/空聊天 **skip** + hint）。保留 INTG-036 军事类（`ListMarches`、`StartMarch` handoff、`ListBattleReports`、`ListPlayerMail` 战报 tab、`ListPlayerQuests` 军事链）及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG037Wave40SmokePath' -count=1 -v
```

与 INTG-036 / INTG-035 / INTG-034 / INTG-033 / INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG037Wave40SmokePath|TestINTG036Wave39SmokePath|TestINTG035Wave38SmokePath|TestINTG034Wave37SmokePath|TestINTG033Wave36SmokePath|TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-037:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 39 网关冒烟（INTG-036，推荐）

在 INTG-035 全量断言之上强制验收 **小地图军情同步**：`military.v1.ListMarches` 打印 **多行** `march_id`/`phase`/`to_x`/`to_y` + 首条 `depart_at_ms`/`arrive_at_ms` ETA hint（供 CLIENT-220/221 对照；空列表 **skip** + hint）；**出征军情交接**：`military.v1.StartMarch`（文档所称 `MarchAttack` 同源出征路径）响应打印 `march_id` hint（供 CLIENT-222 对照；无城/失败 **skip** + hint；**不**测 `CancelMarch`）；**战报坐标互链**：`military.v1.ListBattleReports` 打印首条 `report_id` + `outcome` + 坐标 hint（`location_x`/`location_y` 或 `GetBattleReport` 对照；供 CLIENT-223/224/225 对照；空列表 **skip** + hint；**无** proto 扩量）；**邮件战报 tab**：`content.v1.ListPlayerMail` 分 `mail_type` 计数 + 未领附件 + 战报类首条 `mail_id` hint（标题/正文启发式；供 CLIENT-225 对照；空邮箱 **skip** + hint）；**HUD 军事待办**：`quest.v1.ListPlayerQuests` `chain_id=300` 军事链 + `chain_id=400` `quest_cfg_id=1014`（日课·操练）**进行中**条数 hint（供 CLIENT-226 对照；空 **skip** + hint）。保留 INTG-035/034 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG036Wave39SmokePath' -count=1 -v
```

与 INTG-035 / INTG-034 / INTG-033 / INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG036Wave39SmokePath|TestINTG035Wave38SmokePath|TestINTG034Wave37SmokePath|TestINTG033Wave36SmokePath|TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-036:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 38 网关冒烟（INTG-035，推荐）

在 INTG-034 全量断言之上强制验收 **主城双队列 ETA 分段**：`domestic.v1.GetCityState` 打印 `build_queue` 首条 `upgrade_finish_at_ms` + `building_cfg_id`/`level` + **ETA 分段 hint**（`<1h`/`今日内`/`>1d`，与 CLIENT-212 一致）；`military.v1.RecruitTroop` 响应打印 `recruit_queue` `finish_at_ms` + `unit_cfg_id` 分段 hint（供 CLIENT-212/218 对照；无城/无队列 **skip** + hint）；**将领忠诚养成**：`hero.v1.ListPlayerHeroes` 首条 `hero_id`/`level` + `loyalty` hint + `content.v1.ListPlayerBag` 首条养成 `item_id`/`count`（供 CLIENT-213 对照；空 **skip** + hint）；**双榜**：`rank.v1.GetLeaderboard` 战力/资源榜（文档所称 `ListPowerRank`/`ListKillRank`）打印 `entries` 长度 + 首条 `player_id` + `snapshot_refreshed_at_ms` 冷却对照 hint（供 CLIENT-214 对照；空榜 **skip** + hint）；**招募商城币种**：`hero.v1.ListRecruitTemplates` 币种字段 + `shop.v1.ListShopShelf` 首 SKU `price`/`currency`（`ListShopShelf` ≡ `ListShopProducts`；供 CLIENT-215 对照；**不**扩 SKU）；**日常 HUD**：`quest.v1.ListPlayerQuests` `chain_id=400` 可领取条数 + `GetQuestChainStatus` chain 类型 hint + `content.v1.ListPlayerMail` 未领附件计数（供 CLIENT-216/218 对照；双空 **skip** + hint）；**军团社交**：`guild.v1.ListGuildMembers` 在线摘要 hint + `chat.v1.ListChatMessages` 军团频道首条 `message_id`（文档所称 `ListGuildChatMessages`；无军团/空聊天 **skip** + hint）。保留 INTG-034/033 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG035Wave38SmokePath' -count=1 -v
```

与 INTG-034 / INTG-033 / INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG035Wave38SmokePath|TestINTG034Wave37SmokePath|TestINTG033Wave36SmokePath|TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-035:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 37 网关冒烟（INTG-034，推荐）

在 INTG-033 全量断言之上强制验收 **世界多行军叠标**：`military.v1.ListMarches` 打印 **多行** `to_x`/`to_y`/`phase` + 首条 `depart_at_ms`/`arrive_at_ms` ETA hint（供 CLIENT-204/205 对照；仅 1 条时 **hint** + 可选第二次 `StartMarch`；空列表 **skip** + hint）；**出征余量**：`domestic.v1.GetCityState` 打印 `wallet` 四资源 + `production_rates` 首资源 + 驻防余量 hint（`StartMarchResponse.city_troops` / `ListMarches[].troops`；无城 **skip** + hint；供 CLIENT-206 对照）；**战报密度**：`military.v1.ListBattleReports` 打印首条 `report_id` + `created_at_ms` + `outcome` + `GetBattleReport` 回合数 hint + 前两条 outcome **streak** hint（供 CLIENT-207/208 对照；空列表 hint only）；**邮件日常 HUD**：`content.v1.ListPlayerMail` **分 tab**（`ALL` 页未领附件 + `UNREAD` filter `total_count`）+ `quest.v1.ListPlayerQuests` `chain_id=400` 可领取条数 **同一行**（供 CLIENT-209 对照；双空 **skip** + hint）；**背包商城返回**：`content.v1.ListPlayerBag` 首条 `item_id` + `shop.v1.ListShopShelf` 首 SKU `price`/`currency`（`ListShopShelf` ≡ 文档所称 `ListShopProducts`；供 CLIENT-210 对照；**不**扩 SKU）。保留 INTG-033/032 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG034Wave37SmokePath' -count=1 -v
```

与 INTG-033 / INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG034Wave37SmokePath|TestINTG033Wave36SmokePath|TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-034:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 36 网关冒烟（INTG-033，推荐）

在 INTG-032 全量断言之上强制验收 **主城队列剩余**：`domestic.v1.GetCityState` 打印 `build_queue` 首条 `upgrade_finish_at_ms` + `building_cfg_id`/`level`（供 CLIENT-196/197 对照；无城/无队列 **skip** + hint）；**将领养成对比**：`hero.v1.ListPlayerHeroes` 打印首条 `hero_id`/`level` + `loyalty` 养成 hint（供 CLIENT-198/199 对照；空列表 **skip** + hint）；**社交军团聊天**：`guild.v1.ListGuildMembers` 打印各 `role` 计数 + `chat.v1.ListChatMessages` 军团频道首条 `message_id` hint（供 CLIENT-200 对照；无军团/空聊天 **skip** + hint）；**招募表单与背包**：`hero.v1.RecruitHero` 校验失败或成功 `hero_id` hint + `content.v1.ListPlayerBag` 首条养成相关 `item_id`（供 CLIENT-201 对照；无模板 **skip** + hint；**不**扩 SKU）；**HUD 深链待办**：`quest.v1.ListPlayerQuests` `chain_id=400` 可领取条数 + `content.v1.ListPlayerMail` 未领附件计数 **同一行**合并 hint（供 CLIENT-202 对照；双空 **skip** + hint）。保留 INTG-032/031 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG033Wave36SmokePath' -count=1 -v
```

与 INTG-032 / INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG033Wave36SmokePath|TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-033:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 35 网关冒烟（INTG-032，推荐）

在 INTG-031 全量断言之上强制验收 **世界格点与小地图**：`world.v1.ListPlayerCities` 打印首条 `x`/`y`/`name`（供 CLIENT-188 对照；无城 **skip** + hint）；**军情出征同步**：`military.v1.ListMarches` 打印首条 `march_id` + `to_x`/`to_y` + `phase`（供 CLIENT-188/189 对照；无行军 **skip** + hint）；**战报复盘**：`military.v1.ListBattleReports` 打印首条 `report_id` + `outcome` + 坐标字段 hint（`location_x`/`location_y` 或 `GetBattleReport` hint；供 CLIENT-190/191 对照；空列表 hint only）；**邮件领取**：`content.v1.ListPlayerMail` 打印未领附件计数 + 首条含附件 `mail_id` hint（供 CLIENT-192 对照；空邮箱 **skip** + hint）；**日常可领进度**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印可领取条数 + 首条 `progress_current`/`progress_target`（供 CLIENT-193 对照；无可领 **skip** + hint）；**背包商城扫读**：`content.v1.ListPlayerBag` 首条 `item_id` + `shop.v1.ListShopShelf` 首 SKU `price`/`currency`（供 CLIENT-194 对照；空列表 **skip** + hint；**不**扩 SKU）。保留 INTG-031/030 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU/IAP。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG032Wave35SmokePath' -count=1 -v
```

与 INTG-031 / INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG032Wave35SmokePath|TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-032:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 34 网关冒烟（INTG-031，推荐）

在 INTG-030 全量断言之上强制验收 **主城队列与 HUD 产出**：`domestic.v1.GetCityState` 打印 `build_queue` 活跃条数 + 首槽 `building_cfg_id`/`level` + `production_rates` 首资源（供 CLIENT-180/181 对照；无城 **skip** + hint）；**将领列表**：`hero.v1.ListPlayerHeroes` 打印条目数 + 首条 `hero_id`/`level`（供 CLIENT-182 对照；空列表 **skip** + hint）；**招募反馈**：`hero.v1.ListRecruitTemplates` → `RecruitHero` 打印 `hero_id` + 扣费币种 hint（供 CLIENT-183 对照；无模板或失败 **skip** + hint；**不**扩 SKU）；**战力榜密度**：`rank.v1.GetLeaderboard` 战力榜打印 Top3 `rank`/`score` + `my_rank`（供 CLIENT-184 对照；空榜 hint only）；**军团职务分组**：`guild.v1.ListGuildMembers` 打印各 `role` 计数摘要（供 CLIENT-185 对照；无军团 **skip** + hint）；**日常队列锚点**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印首条可领取 `quest_id` + `building_cfg_id` hint（供 CLIENT-186 对照；无可领 **skip** + hint）。保留 INTG-030/029 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG031Wave34SmokePath' -count=1 -v
```

与 INTG-030 / INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG031Wave34SmokePath|TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-031:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 33 网关冒烟（INTG-030，推荐）

在 INTG-029 全量断言之上强制验收 **军情行军信息卡**：`military.v1.ListMarches` 打印首条 `march_id` + `phase` + `from_x`/`from_y` + `to_x`/`to_y` + `depart_at_ms`/`arrive_at_ms`（供 CLIENT-172/178 对照；无行军 **skip** + hint）；**日常奖励扫读**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印首条 **进行中** `progress_current`/`progress_target` + `reward_preview` 道具 hint（供 CLIENT-174 对照；空链或无进行中 **skip** + hint）；**背包 cfg 摘要**：`content.v1.ListPlayerBag` 打印首条 `item_id`（`item_cfg_id`）/`quantity` + `cfg_item.item_type` hint（供 CLIENT-175 对照；空背包 **skip** + hint）；**战报 outcome**：`military.v1.ListBattleReports` 打印首条 `report_id` + `outcome`（供 CLIENT-176 对照；空列表 hint only）；**邮件附件扫读**：`content.v1.ListPlayerMail` 打印 **未领附件** 计数 + 首条含附件邮件的附件类型 hint（供 CLIENT-177 对照；空邮箱 **skip** + hint）。保留 INTG-029/028 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG030Wave33SmokePath' -count=1 -v
```

与 INTG-029 / INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG030Wave33SmokePath|TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-030:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 32 网关冒烟（INTG-029，推荐）

在 INTG-028 全量断言之上强制验收 **建造队列扫读**：`domestic.v1.GetCityState` 打印首条进行中 `upgrade_finish_at_ms`（`build_queue` 等价字段）+ 首建筑 `level`（供 CLIENT-164 对照；无队列 **skip** + hint）；**将领详情养成**：`hero.v1.GetHeroDetail` 打印 `level`/`loyalty` + 招募模板 `recruit_item` 养成道具 hint（供 CLIENT-165 对照；无将 **skip** + hint）；**背包养成道具**：`content.v1.ListPlayerBag` 打印首条养成相关 `item_id`（`item_cfg_id`）/`quantity`（供 CLIENT-165 对照；空背包 **skip** + hint）；**商城货币**：`shop.v1.ListShopShelf` 打印首 SKU `price`/`currency`（供 CLIENT-167 对照；空商城 **skip** + hint）；**战力榜深链**：`rank.v1.GetLeaderboard` 战力榜 Top1 `player_id`（`entity_id`；供 CLIENT-168 对照；空榜 hint only）；**日常多链**：`quest.v1.ListPlayerQuests` `chain_id=400` 与 `chain_id=401`（若存在）各 **进行中**条数（供 CLIENT-169 对照；缺链 hint only）；**世界格点**：`world.v1.ListPlayerCities` 打印首条 `x`/`y`/`name`（供 CLIENT-170 对照；无城 **skip** + hint）。保留 INTG-028/027 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG029Wave32SmokePath' -count=1 -v
```

与 INTG-028 / INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG029Wave32SmokePath|TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-029:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 31 网关冒烟（INTG-028，推荐）

在 INTG-027 全量断言之上强制验收 **出征提交反馈**：`StartMarch` 既有路径后 `military.v1.ListMarches` 打印 **最新** `march_id` + `phase` + `to_x`/`to_y`（供 CLIENT-156 对照；无行军 **skip** + hint）；**募兵队列**：`military.v1.RecruitTroop` 打印 `queue_id`/`finish_at_ms`（供 CLIENT-157 对照；无队列或失败 **skip** + hint）；**战报邻接**：`ListBattleReports` 打印条数 + 首/次条 `report_id`（供 CLIENT-158 对照；少于 2 条 hint only）；**邮件角标**：`content.v1.ListPlayerMail` 打印 **未领附件** 计数 + **未读**计数（供 CLIENT-159/162 对照；空邮箱 **skip** + hint）；**日常可领**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印 **可领取**条数（供 CLIENT-162 HUD 日常角标对照；空链 **skip** + hint）。保留 INTG-027/026 及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG028Wave31SmokePath' -count=1 -v
```

与 INTG-027 / INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG028Wave31SmokePath|TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-028:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 30 网关冒烟（INTG-027，推荐）

在 INTG-026 全量断言之上强制验收 **HUD 产出与仓库**：`domestic.v1.GetCityState` **同一行**打印 `production_rates` 粮/木/铁/石 + `wallet` 余量（供 CLIENT-148 对照；缺字段 **skip** + hint）；**日常进度**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印 **可领取**条数 + 首条 `progress_current`/`progress_target`（供 CLIENT-150 对照；空链 **skip** + hint）；**将领列表**：`hero.v1.ListPlayerHeroes` 打印 `total_count` 与首将 `level`/`loyalty`（供 CLIENT-151 对照；无将 **skip** + hint）；**双榜自我定位**：`rank.v1.GetLeaderboard` 战力榜与资源榜各打印 `my_rank`/`my_score`（供 CLIENT-152 对照；空榜 hint）；**背包堆叠**：`content.v1.ListPlayerBag` 打印条目数与首条 `quantity`（供 CLIENT-153 对照；空背包 **skip** + hint）。保留 INTG-026 行军格点 ETA、战报坐标、邮件角标、世界格点及更早链路。

**本波仍不做** `CancelMarch`/行军与募兵加速/主城建造新 RPC/战报 proto 扩量/新商城 SKU。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG027Wave30SmokePath' -count=1 -v
```

与 INTG-026 / INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG027Wave30SmokePath|TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-027:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 29 网关冒烟（INTG-026，推荐）

在 INTG-025 全量断言之上强制验收 **军情格点与 ETA**：`military.v1.ListMarches` 打印首条 `march_id` + `to_x`/`to_y` + `arrive_at_ms` + `phase`（供 CLIENT-139/140/141 对照；无行军 **skip** + hint）；**战报坐标**：`ListBattleReports` 首条 `report_id` → `GetBattleReport` 打印 `summary.location_x`/`location_y`（供 CLIENT-142 对照；无战报 **skip** + hint）；**邮件角标**：`content.v1.ListPlayerMail` 打印 **未读**与**未领附件**计数（供 CLIENT-143 对照；与 INTG-024 口径一致）；**世界格点**：`world.v1.ListPlayerCities` 打印 `cities` 条数与首条格点 `x`/`y`（供 CLIENT-140 对照）。保留 INTG-025 七槽/将领/`production_rates`、INTG-024 筛选字段、INTG-023 经济军事 optional 及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG026Wave29SmokePath' -count=1 -v
```

与 INTG-025 / INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG026Wave29SmokePath|TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-026:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 28 网关冒烟（INTG-025，推荐）

在 INTG-024 全量断言之上强制验收 **主城七槽**：`domestic.v1.GetCityState` 同一响应打印七槽 `buildings` 各 `slot_key` + `level` + `upgrade_finish_at_ms` 摘要，并与 `production_rates` 粮/木/铁/石 **同一行**（供 CLIENT-130/131/134 对照；缺槽 **skip** + hint）；**将领列表**：`hero.v1.ListPlayerHeroes` 打印 `total_count` 与首将 `hero_id` + `level` + `loyalty`（供 CLIENT-132/133 对照；无将 **skip** + hint）。保留 INTG-024 `ListPlayerMail` 未读/未领附件与 `ListPlayerQuests` `chain_id=400` 可领取计数（供 CLIENT-134 深链对照），以及 INTG-023 背包/商城/将领详情/募兵 optional、军情 phase、战报 outcome 与进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG025Wave28SmokePath' -count=1 -v
```

与 INTG-024 / INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG025Wave28SmokePath|TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-025:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 27 网关冒烟（INTG-024，推荐）

在 INTG-023 全量断言之上强制验收 **邮件角标字段**：`content.v1.ListPlayerMail` 同一 ALL 页打印 **未读**与**未领附件**等价计数（`unread_count` + `unclaimed_attachment_count` 页内推导，供 CLIENT-122 对照；与 INTG-022/020 口径一致）；**日常可领**：`quest.v1.ListPlayerQuests` `chain_id=400` 打印 **可领取**条数（供 CLIENT-123 对照）；**军情 phase 摘要**：`military.v1.ListMarches` 打印各 **phase** 计数摘要与首条 `phase`（供 CLIENT-124 对照）；**战报 outcome 摘要**：`military.v1.ListBattleReports`（与 INTG-013/015 同入口）打印 **胜/负**（`outcome` 1/2）条数摘要（供 CLIENT-125 对照；空列表 **skip** + hint）。保留 INTG-023 背包/商城/将领/募兵 optional、INTG-022 建造/邮件/日常/格点、INTG-021 双榜/军团及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG024Wave27SmokePath' -count=1 -v
```

与 INTG-023 / INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG024Wave27SmokePath|TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-024:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

## Wave 26 网关冒烟（INTG-023，推荐）

在 INTG-022 全量断言之上强制验收 **背包堆叠**：`content.v1.ListPlayerBag` 打印 `total_count`（items 条数）与首条 `item_cfg_id` + `stack_count`（`quantity` 字段，供 CLIENT-112/115 对照）；**消耗后堆叠**：`UseConsumable`（INTG-010 路径）后再次 `ListPlayerBag` 校验堆叠变化（失败仅 log、不阻塞）；**商城扣费反馈**：GM grant 钱包后 **可选** `shop.v1.PurchaseShopOffer` 打印 `code` + 首条 offer `cfg_id`（供 CLIENT-113 对照；失败 non-fatal）；**将领详情**：`hero.v1.GetHeroDetail` 打印首将 `hero_id` + `level` + `loyalty`（供 CLIENT-114/115 对照；无将时 skip + hint）；**募兵反馈**：`military.v1.RecruitTroop` **optional** 打印 `code`/`msg`（供 CLIENT-117 对照；与 INTG-014 optional 同口径）；**行军阶段与 ETA**：`military.v1.ListMarches` 打印首条 `march_id` + `phase` + `arrive_at_ms`（供 CLIENT-116 对照）。保留 INTG-022 建造队列/邮件未读/日常 todo/格点、INTG-021 双榜/军团/可选 `RecruitHero`、INTG-020 商城价/附件/建筑 level 及进程重启持久化路径。

**本波仍不做** `CancelMarch`/行军与募兵加速——`military.v1` 契约未定义对应 RPC。

```bash
make dev-up
export DATABASE_URL='postgres://sanguo:sanguo@localhost:5432/sanguo?sslmode=disable'
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG023Wave26SmokePath' -count=1 -v
```

与 INTG-022 / INTG-021 / INTG-020 / INTG-019 / INTG-018 / INTG-017 / INTG-016 / INTG-015 / INTG-014 / INTG-013 / INTG-012 / INTG-011 / INTG-010 / INTG-009 / INTG-008 / INTG-007 / INTG-006 / M4 一并跑：

```bash
GOTOOLCHAIN=go1.23.0 go test ./internal/api -run 'TestINTG023Wave26SmokePath|TestINTG022Wave25SmokePath|TestINTG021Wave24SmokePath|TestINTG020Wave23SmokePath|TestINTG019Wave22SmokePath|TestINTG018Wave21SmokePath|TestINTG017Wave20SmokePath|TestINTG016Wave19SmokePath|TestINTG015Wave18SmokePath|TestINTG014Wave17SmokePath|TestINTG013Wave16SmokePath|TestINTG012Wave15SmokePath|TestINTG011Wave14SmokePath|TestINTG010Wave13SmokePath|TestINTG009Wave12SmokePath|TestINTG008Wave11SmokePath|TestINTG007M4DeepSmokePath|TestINTG006Data002SmokePath|TestM4ContentSmokePath' -count=1 -v
```

失败时测试会打印 `DATA-002 cfg:`、`INTG-007:` … `INTG-023:` 固定 id 行，便于对照 `spec/data/CORE_SUBSET.md`。

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
