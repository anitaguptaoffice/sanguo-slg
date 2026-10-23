# H5 客户端（CLIENT-001 ~ CLIENT-032）

## CLIENT-032 manifest 美术接线

主树 `client/public/assets/art/v1/manifest.json`（#218）已落地样件，H5 接线 asset id：

| asset id | 用途 |
|---|---|
| `res.icon.food.v1` | HUD 顶栏 / 画布粮图标 |
| `res.icon.wood.v1` | HUD 顶栏 / 画布木图标 |
| `res.icon.iron.v1` | HUD 顶栏 / 画布铁图标 |
| `res.icon.stone.v1` | HUD 顶栏 / 画布石图标 |
| `ui.panel.default.v1` | 队列 / 邮件 / 背包 / 日常面板根 nine-slice（`artPanelSkin.skinNineSlicePanel`） |

图标缺失时 HUD 回退为「粮/木/铁/石/币 + 数值」纯文字（与 CLIENT-011 一致）。面板根节点设 `data-art-skin="off"` 可跳过 nine-slice。军事专用皮肤不在本卡范围。

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
| **HUD 资源增加摘要** | [手动验收（HUD 资源变动，CLIENT-018）](#手动验收hud-资源变动-client-018)（[#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) / [#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191)） |

## Wave 12 可玩加深（M4 出口 / INTG-009）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-009** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量。

| 能力 | 验收小节 |
|---|---|
| **行军列表**（`ListMarches`、出征后反馈） | [手动验收（募兵 → 行军 → 战报，CLIENT-012 / CLIENT-013）](#手动验收募兵--行军--战报client-012--client-013) 步骤 3–4；世界坐标填入出征见 **CLIENT-015**（[#180](https://github.com/anitaguptaoffice/sanguo-slg/issues/180) / [#186](https://github.com/anitaguptaoffice/sanguo-slg/pull/186)） |
| **将领详情**（`GetHeroDetail`、列表可读性） | [手动验收（将领详情 CLIENT-014）](#手动验收将领详情-client-014) |
| **邮件**（收件箱 / 已读 / 领附件） | [手动验收（邮件收件箱，CLIENT-017）](#手动验收邮件收件箱client-017)（[#182](https://github.com/anitaguptaoffice/sanguo-slg/issues/182) / [#190](https://github.com/anitaguptaoffice/sanguo-slg/pull/190)）；招募相关仍见 [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) |
| **战报筛选**（outcome 客户端筛选 + 详情摘要） | [手动验收（战报筛选 CLIENT-016）](#手动验收战报筛选-client-016) |
| **HUD 资源变动提示** | [手动验收（HUD 资源变动，CLIENT-018）](#手动验收hud-资源变动-client-018)（[#183](https://github.com/anitaguptaoffice/sanguo-slg/issues/183) / [#191](https://github.com/anitaguptaoffice/sanguo-slg/pull/191)） |

## Wave 13 闭环加深（M4 出口 / INTG-010）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-010** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC，需未来 contract 卡）。

| 能力 | 验收小节 |
|---|---|
| **内政/募兵队列倒计时** | [手动验收（队列 CLIENT-019）](#手动验收队列-client-019)（[#196](https://github.com/anitaguptaoffice/sanguo-slg/issues/196) / [#206](https://github.com/anitaguptaoffice/sanguo-slg/pull/206)） |
| **建造队列加速符** | [手动验收（队列加速 CLIENT-026）](#手动验收队列加速-client-026)（[#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214)） |
| **背包使用 / 商城购买可读反馈** | [手动验收（背包与商城反馈，CLIENT-020）](#手动验收背包与商城反馈-client-020)（[#197](https://github.com/anitaguptaoffice/sanguo-slg/issues/197) / [#204](https://github.com/anitaguptaoffice/sanguo-slg/pull/204)） |
| **排行双榜只读**（战力 / 资源总量 + 快照元数据） | [手动验收（排行双榜 CLIENT-021）](#手动验收排行双榜-client-021)（[#198](https://github.com/anitaguptaoffice/sanguo-slg/issues/198) / [#207](https://github.com/anitaguptaoffice/sanguo-slg/pull/207)） |
| **军团 / 聊天可读联调** | [手动验收（M3：选服 / 聊天 / 军团 / 排行，CLIENT-022）](#手动验收m3选服--聊天--军团--排行client-022)（[#199](https://github.com/anitaguptaoffice/sanguo-slg/issues/199) / [#205](https://github.com/anitaguptaoffice/sanguo-slg/pull/205)） |
| **招募成功 ↔ 日常将领任务闭环** | [手动验收（M4：将领，CLIENT-008）](#手动验收m4将领client-008) 步骤 3（**CLIENT-023**，[#200](https://github.com/anitaguptaoffice/sanguo-slg/issues/200) / [#208](https://github.com/anitaguptaoffice/sanguo-slg/pull/208)） |

## Wave 14 日常与队列闭环（M4 出口 / INTG-011）

在 `make dev` 下联调的最短人工路径（与 `tools/smoke/README.md`、**INTG-011** 网关冒烟一致）。**范围外**：DATA-003、`cfg_act*`、不可逆消费扩量；行军 **取消/加速**（`military.v1` 无 RPC，需未来 contract 卡）；募兵队列 **加速**（本波仅建造队列，见 **DOM-003** / **CLIENT-026**）。

| 能力 | 验收小节 |
|---|---|
| **建造加速真实生效**（道具 2003 → domestic `upgrade_finish_at_ms`） | [手动验收（队列加速 CLIENT-026）](#手动验收队列加速-client-026)（[#214](https://github.com/anitaguptaoffice/sanguo-slg/issues/214) / [#222](https://github.com/anitaguptaoffice/sanguo-slg/pull/222)；服务端 **DOM-003** [#211](https://github.com/anitaguptaoffice/sanguo-slg/issues/211) / [#221](https://github.com/anitaguptaoffice/sanguo-slg/pull/221)） |
| **多类型日常引导**（chain 400 练兵/建造/战备） | [手动验收（日常练兵/建造/战备 CLIENT-024）](#手动验收日常练兵建造战备-client-024)（[#212](https://github.com/anitaguptaoffice/sanguo-slg/issues/212) / [#220](https://github.com/anitaguptaoffice/sanguo-slg/pull/220)） |
| **行军结束 → 战报提示**（到达 toast + 战报未读） | [手动验收（行军到达与战报未读 CLIENT-025）](#手动验收行军到达与战报未读-client-025)（[#213](https://github.com/anitaguptaoffice/sanguo-slg/issues/213) / [#219](https://github.com/anitaguptaoffice/sanguo-slg/pull/219)） |
| **HUD 待办徽章**（邮件 / 日常 / 战报底栏角标） | [手动验收（HUD 待办徽章，CLIENT-027）](#手动验收hud-待办徽章-client-027)（[#215](https://github.com/anitaguptaoffice/sanguo-slg/issues/215) / [#224](https://github.com/anitaguptaoffice/sanguo-slg/pull/224)） |

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

### 手动验收（M3：选服 / 聊天 / 军团 / 排行，CLIENT-022）

1. 连接 `make dev` 后打开 H5，选服列表应出现至少 `S1`（dev 服 1）。
2. 进入主城后点 **「聊天」**：
   - 列表行应含 **频道**（世界/私聊/军团）、**本地时间**（`sent_at_ms`）、**发送者 display_name 与 player_id**、正文。
   - 世界频道发一条消息并点「刷新」应能看到记录；私聊需填对方 `player_id`。
   - **军团**频道需先在「军团」面板创建/加入军团；未入团时客户端拦截发送，状态栏提示需先入团；服务端可能返回 `61005`/`61001`，状态栏显示中文摘要 + `code`。
   - 真实服可用 `cmd/gm mute` 测禁言；mock 网关在世界频道发送内容 **`__mock_mute__`** 可模拟 5 分钟禁言，再次发送应看到 **已被禁言 (code=61006)**。
3. 点 **「军团」**：创建或加入后顶栏 **`guild-summary`** 应持久显示 `guild_id` 与名称（同一会话内切换面板不丢失）；「刷新成员」列表行含 **职务**（`guildRoleLabel`）与 **加入时间**（若 API 返回 `joined_at_ms`）。加入不存在的军团时状态栏应可读（如 `军团不存在 (code=60001)`）。
4. 点 **「排行」**：双榜与快照元数据见 [CLIENT-021](#手动验收排行双榜-client-021)；本小节侧重军团/聊天可读（CLIENT-022）。
5. M2 军事/内政仍可用：**「军事」**、**「升级农田」** 等。

mock 网关（军团频道 + 禁言桩）：

```bash
cd client && npm run mock:gateway
VITE_GATEWAY_WS_URL=ws://127.0.0.1:19090/ws npm run dev
```

### 手动验收（M4：任务 / 背包 / 商城，对齐 INTG-004）

与 `tools/smoke/README.md` 中 `TestM4ContentSmokePath` 同路径（教程任务 1001、商城 offer 1001、道具 2001）。

1. `make dev` 启动后进入主城，HUD 显示 **币**（`player_wallet.gold`，商城银币价映射到 gold 字段）。
2. **任务**：打开「任务」→「接取」→「上报进度(绝对值2)」→「领奖」。背包应出现谷袋·初备（2001）；HUD 粮/币随奖励变化。
3. **商城**：打开「商城」→「刷新货架」→ 选择 offer 1001 →「购买×1」。余额不足时面板与状态栏显示 `[code] msg`（如 `[64003] 余额不足`）；成功时见 [CLIENT-020](#手动验收背包与商城反馈-client-020)。
4. **背包**：「刷新背包」调用 `content.v1.ListPlayerBag`；「使用道具」调用 `content.v1.UseConsumable`。效果摘要见 [CLIENT-020](#手动验收背包与商城反馈-client-020)。CLIENT-010 起列表行展示道具名/数量摘要，商城货架行展示 offer 标题与价格。

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

### 手动验收（日常练兵/建造/战备 CLIENT-024）

与 DATA-002 / QUEST-003 一致：`daily_train_1`（`quest_cfg_id=1014`）、`daily_build_1`（`1032`）、`daily_march_1`（`1033`，`use_item` + `march_ration` → `item_cfg_id=2020`）。chain 400 **无**手填 `ReportQuestProgress`。

1. `make dev` 进入主城，君主等级满足对应日常解锁（dev 账号通常已够）。
2. 底栏 **「日常」** → **刷新列表**。每行应带 objective 标签（如 `[练兵]`、`[建造]`、`[使用道具]`）+ cfg code + `current/target` 进度（与 ListPlayerQuests 一致）。
3. **daily_train_1**：接取且进行中 → 详情/「下一步」提示募兵 → 点 **「前往下一步」** 应打开 **「队列」** 与 **「军事」**；完成募兵后进度由服务端推进 → **领奖**，顶栏 CLIENT-018 `+…` 飘字与 HUD 更新。
4. **daily_build_1**：接取且进行中 → **「前往下一步」** 打开 **「队列」**；对农田等发起升级并完成队列后进度达标 → 领奖。
5. **daily_march_1**：接取且进行中 → **「前往下一步」** 打开 **「背包」** 并高亮 **2020 远征干粮** → **使用道具** 成功后日常进度推进 → 领奖。
6. 单测：`dailyQuestObjective.test.ts`；全量 `cd client && npm test`。

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
3. **招募**：成功时自动刷新列表并高亮新 `hero_id` 行、加载详情；状态栏展示模板名与扣费摘要（CLIENT-023）。若已接取 `daily_recruit_1`（`quest_cfg_id=1015`）且进行中，状态栏提示打开「日常」，后台刷新 chain 400 列表（进度由 QUEST-002/003 服务端推进）。道具/资源不足时显示服务端 `code` 与 `msg`。

### 手动验收（邮件收件箱，CLIENT-017）

与 `internal/api/mail_handlers.go` 一致：`content.v1.ListPlayerMail`（`filter` 全部/未读）、`MarkPlayerMailRead`、`ClaimMailAttachments`。

1. `make dev` 进入主城；底栏 **「邮件」** 有未读时按钮右上角红色数字角标（不挡点击）。
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

### 手动验收（世界地图行军标注 CLIENT-028）

主城舞台右上角叠加只读 **小地图**（`worldMinimap` / `drawWorldMinimap`）：**己方城池**（会话 `cityX/cityY`，刷新状态时会 `ListPlayerCities` 对齐）与 **ListMarches** 进行中行军 **目的点**。滚轮在小地图区域内缩放、拖拽平移视野；**建筑槽位 hit 区域**仍按 `MAIN_CITY_SLOTS` + `canvasToLayout`，与小地图变换无关。

1. `make dev` 或 mock 网关登录主城，确认舞台右上角有「世界（只读）」框与己方城点（默认 mock 创建城约 60,60）。
2. 完成 [募兵 → 出征](#手动验收募兵--行军--战报client-012--client-013) 后，小地图应出现目的点标记；底栏 **「行军」** 刷新列表后目的坐标与列表 `to_x/to_y` 一致。
3. 在行军列表 **点击一行**：该行高亮，小地图高亮该行军 **起点/终点** 与底部 **阶段文案**（行军中/已到达/撤回中）。
4. 在小地图 **点击目的点**：应选中列表中 **首条** 匹配该坐标的行军（只读，不发起新 RPC）；列表行高亮。
5. 在小地图区域滚轮缩放并拖拽平移后，点击 **农田** 等槽位仍可触发升级/选中（窄屏 letterbox 下 hit 随 `uiScale` 缩放）。
6. 军事面板仍仅有出征表单（**无** 取消行军/加速按钮）；[世界坐标 CLIENT-015](#手动验收世界坐标-client-015) 填入出征目标流程不退化。
7. 单测：`worldMinimap.test.ts`、`MarchListPanel` 选中用例；`cd client && npm test`。

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

### 手动验收（行军到达与战报未读 CLIENT-025）

`MarchArrivalPoll` 轮询 `ListMarches`：出征后跟踪 `march_id`；行军阶段 **marching(2)→arrived(3)/returning(4)** 或列表中该行消失时，顶栏状态栏出现可点链接 **「行军结束，查看战报」**（`MARCH_ARRIVAL_STATUS_TOAST`）。`BattleReportUnreadSession` 记录上次打开战报面板时的 `report_id` 上界，刷新列表后新增战报计入未读（与 **CLIENT-027** 底栏角标联动）。

1. `make dev` 完成 [募兵 → 行军](#手动验收募兵--行军--战报client-012--client-013) 步骤 2–3，保持主城场景（无需一直打开「行军」面板）。
2. 等待行军到达并完成战斗（距离与调度决定耗时；可缩短目标距离）。到达时状态栏应出现 **行军结束，查看战报** 链接。
3. 点击链接应打开底栏 **「战报」** 面板并触发列表刷新；未打开前底栏 **「战报」** 可出现未读角标（见 [CLIENT-027](#手动验收hud-待办徽章-client-027)）。
4. 打开战报面板后未读角标清零；再次产生新战报时角标恢复。
5. 单测：`marchArrival.test.ts`、`marchArrivalPoll.test.ts`、`battleReportUnread.test.ts`、`BattleReportPanel.test.ts`。

### 手动验收（背包与商城反馈，CLIENT-020）

`contentFeedback.ts` 解析 `UseConsumable` / `PurchaseShopOffer` 响应；背包/商城面板内 `panel-feedback` 与顶栏状态栏同步文案。使用资源包(2001) 成功后 **CLIENT-018** 顶栏仍可出现 `+粮…` 短时摘要（`patchSession` + `formatWalletGainBrief`）。

1. `make dev` 或 mock 网关进入主城，**任务领奖**或 **商城购买** 获得谷袋(2001) 与急工符(2003)（mock 购买即得 2001）。
2. **背包**：「刷新背包」→ 选 **2001** →「使用道具」。面板金色反馈区与 HUD 末行应同时显示效果（如「获得粮食 …」「+粮…」）；顶栏粮增加时出现 CLIENT-018 `+粮` 飘字。
3. 选 **2003** →「使用道具」：面板与状态栏应显示加速文案（服务端 `effect_summary` 或 `speedup_seconds` 推导）。
4. 故意数量大于库存或 mock 下耗尽道具：失败时面板与状态栏为 `[code] msg`，不静默。
5. **商城**：「刷新货架」→ offer 1001 →「购买×1」。成功行内追加 `已购 +1`，面板反馈含 `钱包 粮 … 币 …`（与顶栏 HUD 同 `formatResourceHudGroup` 格式）；限购行仍显示 `限购 n/m`；余额不足为 `[64003] 余额不足`（真实服 code 以网关为准）。
6. 单测：`contentFeedback.test.ts`；全量 `cd client && npm test`。

### 手动验收（HUD 资源变动，CLIENT-018）

承接 **CLIENT-011** 顶栏五资源；`hudFormat.formatWalletGainBrief` 对比领奖/购买前后 `wallet` 字段，在 `#hud` 短时显示 `+粮/+木/+铁/+石/+币` 摘要（约数秒淡出）。`CityStateFetch` 对 `domestic.v1.GetCityState` **单飞去重**；`cityStatePoll` 在主城：有 DOM 面板打开时约 **5s** 轮询刷新 HUD/建筑等级，无面板时约 **30s** 降频。

1. `make dev` 进入主城，记下顶栏粮/币等初值。
2. **日常领奖**或 **任务领奖**（见 [日常 chain 400](#手动验收日常-chain-400client-009)）：领奖成功后顶栏应出现对应 `+…` 摘要，随后数值与 HUD 一致。
3. **商城购买**或 **邮件领附件**（见 [CLIENT-017](#手动验收邮件收件箱client-017)）：`wallet_after` 增加时同样出现摘要。
4. **将领招募**成功且扣费/消耗后若钱包净增（mock 少见），摘要行为一致；纯扣费无 `+` 提示。
5. 打开 **「任务」** 或 **「邮件」** 面板停留：观察 HUD 仍周期性刷新（5s 档）；关闭所有面板后频率降低（30s 档），浏览器网络面板中 `GetCityState` 无并发重复请求（单飞）。
6. 视口 **1280×720** 与 **1600×900**：`+粮` 摘要不遮挡底栏 56px 行（见 `layoutViewport` 单测）。

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

### 手动验收（排行双榜 CLIENT-021）

与 `rank.v1.GetLeaderboard` 网关一致（`make dev` 真实 PG；mock 网关返回固定条目）。

1. 进入主城后点 **「排行」** → 榜单类型下拉应含 **战力榜**、**资源总量榜**（`LB_PLAYER_POWER` / `LB_PLAYER_RESOURCE`）。
2. 切换类型后点 **「刷新榜单」**：列表行格式为 `名次. 显示名 · 分数`；面板顶部或摘要区展示 **我的名次**（`my_rank` / `my_score`），未上榜时文案含「未上榜」与当前战力或资源总量。
3. 若网关返回 `snapshot_version` / `snapshot_refreshed_at_ms`（及可选 `batch_id`），面板应展示 **快照批次/刷新时间** 摘要（`formatLeaderboardSnapshotMeta`），便于对照 Scheduler 刷新。
4. 打开排行面板时应自动拉取当前所选类型（无需先手动刷新）；失败时状态栏显示可读错误，可重试。
5. 单测：`leaderboardFormat.test.ts`、`SocialPanels.test.ts`（战力榜打开即拉取）。

### 手动验收（队列 CLIENT-019）

1. `make dev` 下联调，主城底栏 **「队列」**（mock 无募兵队列）。
2. 升级农田等使 `upgrade_finish_at_ms > now`：列表含槽位、目标等级、`formatUpgradeRemaining` 剩余时间与完成时刻；打开面板时 1s 刷新，关闭即停。
3. 军事募兵若返回 `queue_id`/`finish_at_ms`：列表显示兵种/数量/倒计时；完成后提示刷新兵力，可点「刷新内政」或「刷新状态」并打开军事。
4. **1600×900** 下面板可滚动。

### 手动验收（队列加速 CLIENT-026）

1. `make dev` 下联调；确保背包有 **道具 2003**（短促工符 / 急工符·五刻，可用 GM 发放或商城购买后「刷新背包」）。
2. 主城升级一槽建筑（如农田），使 `upgrade_finish_at_ms > now`；打开底栏 **「队列」**，进行中建造行旁应出现 **「使用短促工符」**。
3. 无 2003 或数量为 0 时按钮应 **禁用**（悬停提示道具不足）；无进行中建造时不应出现可点的加速（或点击后提示无建造）。
4. 点击 **「使用短促工符」**：调用 `content.v1.UseConsumable`（`item_cfg_id=2003`，`count=1`）；面板底部 `queue-status` 与 HUD 状态栏展示 `effect_summary` 或推导的加速秒数。
5. 成功后自动 **GetCityState**：队列行剩余时间应缩短（`upgrade_finish_at_ms` 前移，依赖服务端 DOM-003）；背包 2003 数量减 1。可对比使用前后面板倒计时或完成时刻。
6. 募兵行 **无** 加速按钮（本卡仅建造队列）。单测：`QueuePanels.test.ts`、`bagState`（`bagStackQuantity`）。

### 手动验收（HUD 待办徽章，CLIENT-027）

底栏 **邮件 / 日常 / 战报** 右上角数字角标（`pointer-events: none`，不挡按钮点击）；轮询间隔与 CLIENT-018 `CityStatePoll` 同档（面板打开 5s / 关闭 30s），各来源请求单飞。

1. `make dev` 或 mock 进主城：有未读邮件时 **「邮件」** 角标为 `ListPlayerMail` 未读 `total_count`；chain 400 存在 **可接(1)** 或 **可领奖(3)** 日常时 **「日常」** 角标为对应条数；新战报相对上次打开战报面板为 **「战报」** 角标（CLIENT-025 `BattleReportUnreadSession`）。
2. 点开对应面板后该入口角标立即清零；关闭面板后随轮询恢复（邮件未读、日常待办、战报未读各自独立）。
3. 行军到达 HUD 提示点开后战报角标同样清零。
4. 视口 **1600×900**：角标叠在按钮内侧右上，底栏仍可正常点按。

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

单测包含 `layoutViewport`（横屏 letterbox / 1280×720）、`hudFormat`（资源条分组数值与 `+粮` 摘要）、`hudTodoBadge` / `HudTodoBadgePoll` / `toolbarBadge`（待办角标聚合与单飞轮询）、`queueState` / `QueuePanels`（内政升级与募兵队列行、建造加速符 UseConsumable）、`contentFeedback`（背包/商城效果与网关错误文案）、`cityStateFetch` / `cityStatePoll`（GetCityState 单飞与降频轮询）、`militaryFormat`、`socialFormat` / `SocialPanels`（聊天行格式、军团摘要、禁言错误可读）、`bagState`（网关背包合并）、`BattleReportPanel` / `MarchListPanel`（空列表/加载失败/列表行）、`dailyQuestObjective` / `dailyQuestState` / `DailyQuestPanels`（chain 400 多类型标签、下一步导航与领奖合并）、`heroMailState`（招募模板/收件箱 filter·摘要·领取合并）/ `HeroMailPanels`（未读切换、点开已读、角标）与 `StartMarchRequest` / `ListMarchesRequest` proto 编解码。

## 目录

- `src/engine/` — `GameApp`、`layoutViewport`、`mainCitySlots`、场景管理、`AssetLoader`（art v1 manifest）
- `src/net/` — `GatewayClient`、`bootstrapSession`、`militaryFormat`、proto 加载
- `src/scenes/` — 选服、主城（军事 + M3 社交面板）
- `src/ui/` — 聊天/军团/排行、任务/日常/战报/行军、背包/商城/将领/邮件 DOM 面板
- `proto/` — 与后端 INTG 对齐的扩展 proto（不写入 `spec/`）
- `mock-server/` — 登录 + 军事桩 WebSocket mock
