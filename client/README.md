# H5 客户端（CLIENT-001 ~ CLIENT-018）

技术栈与引擎备选说明见仓库根 [docs/client-engine.md](../docs/client-engine.md)（**当前**为 Vite + TS + Canvas 2D / DOM，非 Cocos）。

Vite + TypeScript 跑通引擎初始化、场景切换、占位资源与 **WebSocket + Protobuf** 全链路：

**选服列表 → 登录/进服 → 拉城/建城 → 主城（内政/军事/战报/任务/日常/背包/商城/将领/邮件）→ 世界/私聊 → 军团 → 战力排行**

## Wave 11 可玩环（M4 出口 / INTG-008）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-008** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量。

| 能力 | 验收小节 |
|---|---|
| **日常 UI**（chain 400，无手填上报） | [手动验收（日常 chain 400，CLIENT-009）](#手动验收日常-chain-400client-009) |
| **招募模板预览**（将领面板 + 背包/商城可读性） | [手动验收（M4：将领 / 邮件，CLIENT-008）](#手动验收m4将领--邮件client-008) 步骤 2；背包/商城行文案见 **CLIENT-010**（#171） |
| **战报入口**（底栏独立面板） | [手动验收（募兵 → 行军 → 战报）](#手动验收募兵--行军--战报) 步骤 4（**CLIENT-012**，#170） |
| **HUD 资源条与建筑等级** | **CLIENT-011**（[#165](https://github.com/anitaguptaoffice/sanguo-slg/issues/165) / [#172](https://github.com/anitaguptaoffice/sanguo-slg/pull/172)）：顶栏粮/木/铁/石/币与画布槽位等级见 [横屏布局 CLIENT-007](#手动验收横屏布局-client-007) 与上文 `hudFormat` 说明 |
| **HUD 资源增加摘要** | **CLIENT-018**：任务/邮件领奖、商城购买、招募后若钱包增加，顶栏短时显示 `+粮/+木…`（`formatWalletGainBrief`）；`GetCityState` 经 `CityStateFetch` 单飞轮询，面板关闭时 30s、打开时 5s |

## Wave 12 可玩加深（M4 出口 / INTG-009）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-009** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量。

| 能力 | 验收小节 |
|---|---|
| **行军列表**（`ListMarches`、出征后反馈） | [手动验收（募兵 → 行军 → 战报，CLIENT-012 / CLIENT-013）](#手动验收募兵--行军--战报client-012--client-013) 步骤 3–4；世界坐标填入出征见 **CLIENT-015**（[#180](https://github.com/anitaguptaoffice/sanguo-slg/issues/180) / [#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)） |
| **将领详情**（`GetHeroDetail`、列表可读性） | [手动验收（将领详情 CLIENT-014）](#手动验收将领详情-client-014) |
| **邮件**（收件箱 / 已读 / 领附件） | [手动验收（邮件收件箱，CLIENT-017）](#手动验收邮件收件箱client-017)（[#182](https://github.com/anitaguptaoffice/sanguo-slg/issues/182) / [#190](https://github.com/anitaguptaoffice/sanguo-slg/pull/190)）；招募相关仍见 [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) |
| **战报筛选**（outcome 客户端筛选 + 详情摘要） | [手动验收（战报筛选 CLIENT-016）](#手动验收战报筛选-client-016) |
| **HUD 资源变动提示**（可选） | **CLIENT-018**（[#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183)）：领奖/购买/招募成功后顶栏短时「+粮/+木…」摘要 |

## 网关地址

| 环境 | 变量 / 地址 |
|------|-------------|
| 本地 `make dev`（**默认**） | `ws://127.0.0.1:8080/ws` |
| 本地 mock（登录 + 军事桩） | `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws` |
| 其他环境 | 构建前设置 `VITE_GATEWAY_WS_URL` |

配置见 `src/config.ts`。军事消息定义在 `spec/proto/sanguo/military/v1/military.proto`（客户端通过 `loadProto` 加载 spec + `client/proto` 扩展，不修改 `spec/`）。

## 联调真实后端（推荐）

```bash
# 仓库根目录：Postgres + Redis + Go 网关（INTG-002 战斗闭环）
make dev

# 另一终端：H5
cd client && npm install && npm run dev
# 浏览器 http://localhost:5173
```

默认账号：`demo` / `demo123`。启动后先在 **选服界面** 点选服务器再「进入游戏」。

布局基线见仓库根 [`docs/art/layout-landscape.md`](../docs/art/layout-landscape.md)（**1600×900** 外框、舞台 **1600×788**、HUD/底栏各 **56px**）。实现入口：`src/engine/layoutViewport.ts`、`src/engine/mainCitySlots.ts`、`GameApp` 全屏 letterbox。

主城 HUD / 画布上的**建筑等级**（城主府、农田等）来自 `domestic.v1.GetCityState` 响应的 `buildings`（`slot_key`、`level`、`upgrade_finish_at_ms`），见 `src/net/hudFormat.ts` 与 `MainCityScene`。

### 手动验收（横屏布局 CLIENT-007 / HUD CLIENT-011）

1. `cd client && npm run dev`，浏览器打开 H5；窗口可任意比例，页面背景为 `#1a1410`，中间为等比缩放的 **16:9 游戏外框**（非 16:9 时出现上下或左右黑边）。
2. 开发者工具将视口设为 **1600×900**：画布外框应贴满窗口；主城 **HUD** 占顶栏 56px（`#hud` 叠在画布上缘），**底栏** 按钮行占底部 56px（`.layout-toolbar`），中间为舞台。CLIENT-011：`#hud` 应展示五资源当前值；城主府/农田等槽位标签含 **Lv.N**（升级进行中时可带完成时间摘要）。
3. 视口 **1280×720**：外框缩放至 1280×720（`uiScale=0.8`，见 `layoutViewport.test.ts`）；`mc.bg.plateau.v1` 仍铺满舞台 y∈[56,844)，`hall`/`farm` 样件与槽位对齐（可对照 `docs/art/maincity-slots.md`）。
4. 视口 **400×900**（窄屏）：左右贴边、上下 letterbox；点击农田槽位仍可触发升级（hit 区域随 `uiScale` 缩放）。
5. 选服界面面板居中落在舞台区域内（顶底各留 56px 带）。

### 手动验收（M3：选服 / 聊天 / 军团 / 排行）

1. 连接 `make dev` 后打开 H5，选服列表应出现至少 `S1`（dev 服 1）。
2. 进入主城后点 **「聊天」**：世界频道发一条消息并点「刷新」应能看到记录；私聊需填对方 `player_id`；**军团**频道需先在「军团」面板创建/加入军团，再选「军团」频道收发（`chat.v1` + `guild_id`，WIRE-001 真实网关与 mock 均支持）。
3. 点 **「军团」**：输入名称「创建军团」，或填已有 `guild_id` 加入，再「刷新成员」。
4. 点 **「排行」**：「刷新战力榜」应列出榜单，并显示 **我的名次**（未上榜时显示战力与「未上榜」）。
5. M2 军事/内政仍可用：**「军事」**、**「升级农田」** 等。

### 手动验收（M4：任务 / 背包 / 商城，对齐 INTG-004）

与 `tools/smoke/README.md` 中 `TestM4ContentSmokePath` 同路径（教程任务 1001、商城 offer 1001、道具 2001）。

1. `make dev` 启动后进入主城，HUD 显示 **币**（`player_wallet.gold`，商城银币价映射到 gold 字段）。
2. **任务**：打开「任务」→「接取」→「上报进度(绝对值2)」→「领奖」。背包应出现谷袋·初备（2001）；HUD 粮/币随奖励变化。
3. **商城**：打开「商城」→「刷新货架」→ 选择 offer 1001 →「购买×1」。余额不足时状态栏显示服务端错误；成功时 HUD **币** 减少且背包数量增加（`wallet_after` 真扣费，无 spent overlay）。
4. **背包**：「刷新背包」调用 `content.v1.ListPlayerBag` 拉服务端持久化全量并覆盖会话背包展示；「使用道具」调用 `content.v1.UseConsumable`（与 `internal/api/content_handlers.go` 一致）。资源包(2001)/加速符(2003) 使用成功后 HUD 粮/币或状态栏效果摘要应更新。CLIENT-010 起列表行展示道具名/数量摘要，商城货架行展示 offer 标题与价格，便于对照招募消耗。

### 手动验收（日常 chain 400，CLIENT-009）

与 `tools/smoke/README.md` / INTG-007 中 `daily_food_1`（`quest_cfg_id=1012`，`chain_id=400`）一致；进度由服务端 QUEST-002 自动挂钩，客户端**无**手填上报。

1. `make dev` 进入主城（君主等级须满足 cfg 解锁，dev 账号通常已够）。
2. 底栏点 **「日常」**（与教程 **「任务」** 面板分离）。列表应经 `quest.v1.ListPlayerQuests` + `chain_id=400` 展示 `daily_food_1` 等行：cfg code、状态文案、`current/target` 进度。
3. 选中 `daily_food_1` → **接取** → 通过内政收粮或等待资源累积使进度达标（真实服自动推进）→ **领奖**。HUD **粮/木/铁/石/币** 与状态栏背包摘要应更新（`ListPlayerBag` + 领奖 `granted_rewards` 合并，同 ContentPanels）。
4. 视口 **1600×900**：底栏含「日常」且单行不撑破 56px 底栏；面板落在顶底 56px 带之间、可滚动。

mock 网关（chain 400 默认列出 1012）：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（将领详情 CLIENT-014）

在 CLIENT-008 将领面板基础上，验收 `hero.v1.GetHeroDetail` 与列表可读性（`make dev` 或 mock 网关均可）。

1. 点 **「将领」** →「刷新列表」。每行应含 **Lv** 与 **忠诚** 数值（来自 `ListPlayerHeroes`）。
2. 点击某一将领行：详情区展示 **template_name**、**稀有度**、四维属性（武/智/政/统）、**忠诚度及 loyalty_min~loyalty_max 区间**。
3. 详情区末尾应提示：养成道具请走底栏 **「背包」** → **「使用道具」**（`content.v1.UseConsumable`），无将领专用 RPC。
4. 未选将领或 `hero_id=0` 时不应发起 GetHeroDetail；状态栏应提示 hero_id 无效（客户端拦截）。

mock 预置将领时可用 `VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev`，招募一名后再点列表验详情。

### 手动验收（M4：将领，CLIENT-008）

与 `internal/api/hero_handlers.go` 网关路由一致（`make dev` 真实 PG）。

1. 进入主城后点 **「将领」** →「刷新列表」。新号应为空列表提示；若已有将领，点击列表项加载 `hero.v1.GetHeroDetail` 详情（属性/忠诚，见 CLIENT-014）。
2. **招募模板**：点「刷新招募模板」调用 `hero.v1.ListRecruitTemplates`；下拉或列表行展示模板名、稀有度、资源+道具消耗预览（与 HERO-003 / `make dev` 目录一致）。选择模板后「招募」使用所选 `template_cfg_id` 与预览中的 `item_cfg_id`（及 `pool`），不再手填 1001/2004。
3. **招募**：成功时列表出现新将领，状态栏显示 `hero_id`；道具/资源不足时显示服务端 `code` 与 `msg`。

### 手动验收（邮件收件箱，CLIENT-017）

与 `internal/api/mail_handlers.go` 一致：`content.v1.ListPlayerMail`（`filter` 全部/未读）、`MarkPlayerMailRead`、`ClaimMailAttachments`。

1. `make dev` 进入主城；底栏 **「邮件」** 有未读时显示 `邮件(N)` 角标。
2. 打开邮件面板 → **全部 / 未读** 切换列表；每行展示**标题 + 摘要**（正文截断或附件提示）。
3. **点开**一封未读邮件 → 自动调用 `MarkPlayerMailRead`；在「未读」筛选下该封应从列表消失。
4. 带附件邮件显示 **「领取附件」** → 成功后 HUD 五资源与背包摘要更新（`wallet_after` / `bag_items`）；重复领取或失败时面板内显示明确错误文案。
5. 空收件箱显示「收件箱为空…」；未读筛选无信时显示「暂无未读邮件」。
6. 视口 **1600×900**：面板落在顶底 56px 带之间，列表与正文区可滚动、不撑破外框。

**GM 发信（真实 PG）** — 参数见 [`docs/ops/open-server-runbook.md`](../docs/ops/open-server-runbook.md) §4.5：

```bash
# 仓库根；需 DATABASE_URL 等与 make dev 一致
GOTOOLCHAIN=go1.23.0 go run ./cmd/gm send-mail \
  --server-id=1 --player-id=<你的 player_id> \
  --title='测试奖励' --body='CLIENT-017 验收' \
  --food=1000 --gold=50 \
  --reason='CLIENT-017 manual'
```

`player_id` 可在进服后 HUD 或 `cmd/gm lookup` 查到。发信后回到 H5 点邮件 **「刷新」**。

mock 网关预置 1 封欢迎邮件与 2 本名册，便于离线点领：

```bash
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

```bash
# 仓库根
make dev
cd client && npm install && npm run dev
```

### 手动验收（募兵 → 行军 → 战报，CLIENT-012 / CLIENT-013）

1. 登录进入主城后，点 **「军事」** 打开面板。
2. **募兵**：选兵种（默认步兵）、数量（如 50），点「募兵」。HUD 会显示扣费后的资源；若返回 `queue_id` / `finish_at_ms`，需等到完成时间后再出征（服务端调度器在 `make dev` 中自动推进）。
3. **出征**：目标默认 **(5,5)**（M2 驻点），调整出征步兵数量后点「出征攻击」。状态栏与军事面板会显示最近一次行军摘要。
4. 点底栏 **「行军」** → **「刷新列表」**（或等待约 5s 自动刷新）：列表调用 `military.v1.ListMarches`，每行展示目的、阶段、起终点坐标、出发/到达时间。出征成功后若面板已打开会自动刷新。
5. 等待行军到达并完成战斗后（真实环境取决于距离与调度），点 **「战报」** → **「刷新列表」**，点击某条战报查看回合/伤亡摘要（字段以服务端为准）。
6. 面板落在 1600×900 外框内可滚动；内政仍可用：**「升级农田」「刷新状态」**。

### 手动验收（世界坐标 CLIENT-015）

1. 进入主城后点 **「世界」**（或世界城池面板入口，与 `world.v1.ListPlayerCities` 一致）→ **「刷新城池」**。
2. 列表应展示玩家城池坐标；当前主城行标注 **「主城」**。
3. 选中一行 → **「填入出征目标」**：军事面板 `to_x` / `to_y` 应更新为该城坐标（与 CLIENT-013 出征表单联动）。
4. 在 **「军事」** 中调整兵力后 **出征攻击**；底栏 **「行军」** 列表应出现对应目的坐标。

### 手动验收（战报筛选 CLIENT-016）

与 **CLIENT-012** 底栏 **「战报」** 面板一致；筛选仅客户端，不改 `ListBattleReports` 请求参数。

1. `make dev` 下完成至少一次出征并产生战报（见上文募兵 → 行军步骤）。
2. 点 **「战报」** → **「刷新列表」**。面板顶部应有 **全部 / 胜 / 负 / 平** 筛选（基于 `BattleReportSummary.outcome`）；切换筛选后列表行即时过滤，无需重新拉网关。
3. 点击某条战报：详情区展示 **回合数**、攻/守 **伤亡 map 摘要** 与 **result** 文案；字段以服务端为准。
4. 若列表超过一页，使用 **加载更多**（`limit`/`offset`）或既有分页；失败时状态栏文案可重试。
5. 视口 **1600×900**：筛选行与列表落在顶底 56px 带之间、可滚动。

`make dev` 真实网关：

```bash
# 仓库根
make dev
cd client && npm install && npm run dev
```

mock 网关（含 ListMarches 桩，出征后列表可见）：

```bash
cd client && npm run mock:gateway
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 仅 mock 网关

`mock-server` 实现 `Login`、**选服/进服**、**聊天（含军团频道）/军团/排行**、**quest/shop/content.v1 背包** 与军事路由的**即时**桩（募兵无队列）。另含最简建城/内政桩以便进主城；完整内政与持久化请连 `make dev`。

```bash
cd client && npm run mock:gateway   # ws://127.0.0.1:19090/ws
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

## 验证

```bash
cd client && npm test && npm run build
```

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`hudFormat`（资源条分组数值与 `+粮` 摘要）、`cityStateFetch` / `cityStatePoll`（GetCityState 单飞与降频轮询）、`militaryFormat`、`bagState`（网关背包合并）、`BattleReportPanel` / `MarchListPanel`（空列表/加载失败/列表行）、`dailyQuestState` / `DailyQuestPanels`（chain 400 列表与领奖合并）、`heroMailState`（招募模板/收件箱 filter·摘要·领取合并）/ `HeroMailPanels`（未读切换、点开已读、角标）与 `StartMarchRequest` / `ListMarchesRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报/行军、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
